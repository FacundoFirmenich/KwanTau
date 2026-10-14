#define _GNU_SOURCE
#include <errno.h>
#include <fcntl.h>
#include <linux/landlock.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/prctl.h>
#include <sys/syscall.h>
#include <unistd.h>

#ifndef __NR_landlock_create_ruleset
#error "landlock syscalls unavailable in headers"
#endif

static __u64 handled_access(void) {
    __u64 a = LANDLOCK_ACCESS_FS_EXECUTE |
              LANDLOCK_ACCESS_FS_WRITE_FILE |
              LANDLOCK_ACCESS_FS_READ_FILE |
              LANDLOCK_ACCESS_FS_READ_DIR |
              LANDLOCK_ACCESS_FS_REMOVE_DIR |
              LANDLOCK_ACCESS_FS_REMOVE_FILE |
              LANDLOCK_ACCESS_FS_MAKE_CHAR |
              LANDLOCK_ACCESS_FS_MAKE_DIR |
              LANDLOCK_ACCESS_FS_MAKE_REG |
              LANDLOCK_ACCESS_FS_MAKE_SOCK |
              LANDLOCK_ACCESS_FS_MAKE_FIFO |
              LANDLOCK_ACCESS_FS_MAKE_BLOCK |
              LANDLOCK_ACCESS_FS_MAKE_SYM;
#ifdef LANDLOCK_ACCESS_FS_REFER
    a |= LANDLOCK_ACCESS_FS_REFER;
#endif
#ifdef LANDLOCK_ACCESS_FS_TRUNCATE
    a |= LANDLOCK_ACCESS_FS_TRUNCATE;
#endif
    return a;
}

static __u64 ro_access(void) {
    return LANDLOCK_ACCESS_FS_EXECUTE |
           LANDLOCK_ACCESS_FS_READ_FILE |
           LANDLOCK_ACCESS_FS_READ_DIR;
}

static void add_path_rule(int ruleset_fd, const char *path, __u64 access) {
    int fd = open(path, O_PATH | O_CLOEXEC);
    if (fd < 0) {
        fprintf(stderr, "landlock: cannot open %s: %s\n", path, strerror(errno));
        exit(70);
    }
    struct landlock_path_beneath_attr rule = {
        .allowed_access = access,
        .parent_fd = fd,
    };
    if (syscall(__NR_landlock_add_rule, ruleset_fd, LANDLOCK_RULE_PATH_BENEATH, &rule, 0) < 0) {
        fprintf(stderr, "landlock: add rule %s failed: %s\n", path, strerror(errno));
        close(fd);
        exit(71);
    }
    close(fd);
}

int main(int argc, char **argv) {
    int abi = syscall(__NR_landlock_create_ruleset, NULL, 0, LANDLOCK_CREATE_RULESET_VERSION);
    if (abi < 1) {
        fprintf(stderr, "landlock: ABI unavailable: %s\n", strerror(errno));
        return 72;
    }

    struct landlock_ruleset_attr ruleset = {.handled_access_fs = handled_access()};
    int ruleset_fd = syscall(__NR_landlock_create_ruleset, &ruleset, sizeof(ruleset), 0);
    if (ruleset_fd < 0) {
        fprintf(stderr, "landlock: create ruleset failed: %s\n", strerror(errno));
        return 73;
    }

    int i = 1;
    for (; i < argc; ) {
        if (strcmp(argv[i], "--") == 0) {
            ++i;
            break;
        }
        if (i + 1 >= argc) {
            fprintf(stderr, "usage: %s [--ro PATH|--rw PATH]... -- COMMAND [ARGS...]\n", argv[0]);
            return 64;
        }
        if (strcmp(argv[i], "--ro") == 0) {
            add_path_rule(ruleset_fd, argv[i + 1], ro_access());
        } else if (strcmp(argv[i], "--rw") == 0) {
            add_path_rule(ruleset_fd, argv[i + 1], handled_access());
        } else {
            fprintf(stderr, "landlock: unknown argument %s\n", argv[i]);
            return 64;
        }
        i += 2;
    }
    if (i >= argc) {
        fprintf(stderr, "landlock: missing command\n");
        return 64;
    }
    if (prctl(PR_SET_NO_NEW_PRIVS, 1, 0, 0, 0) < 0) {
        fprintf(stderr, "landlock: PR_SET_NO_NEW_PRIVS failed: %s\n", strerror(errno));
        return 74;
    }
    if (syscall(__NR_landlock_restrict_self, ruleset_fd, 0) < 0) {
        fprintf(stderr, "landlock: restrict_self failed: %s\n", strerror(errno));
        return 75;
    }
    close(ruleset_fd);
    fprintf(stderr, "KWAN_LANDLOCK_ABI=%d\n", abi);
    execvp(argv[i], &argv[i]);
    fprintf(stderr, "landlock: exec failed: %s\n", strerror(errno));
    return 76;
}
