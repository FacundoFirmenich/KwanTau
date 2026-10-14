#include <errno.h>
#include <fcntl.h>
#include <seccomp.h>
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>

static void deny(scmp_filter_ctx ctx, int syscall_nr) {
    if (seccomp_rule_add(ctx, SCMP_ACT_ERRNO(EPERM), syscall_nr, 0) < 0) {
        fprintf(stderr, "seccomp: failed to add rule %d\n", syscall_nr);
        exit(70);
    }
}

int main(int argc, char **argv) {
    if (argc != 2) {
        fprintf(stderr, "usage: %s OUTPUT.bpf\n", argv[0]);
        return 64;
    }
    scmp_filter_ctx ctx = seccomp_init(SCMP_ACT_ALLOW);
    if (!ctx) return 71;
    deny(ctx, SCMP_SYS(socket));
    deny(ctx, SCMP_SYS(connect));
    deny(ctx, SCMP_SYS(mount));
    deny(ctx, SCMP_SYS(umount2));
    deny(ctx, SCMP_SYS(ptrace));
    deny(ctx, SCMP_SYS(bpf));
    deny(ctx, SCMP_SYS(perf_event_open));
    deny(ctx, SCMP_SYS(setns));
    deny(ctx, SCMP_SYS(unshare));
    int fd = open(argv[1], O_CREAT | O_TRUNC | O_WRONLY, 0600);
    if (fd < 0) return 72;
    if (seccomp_export_bpf(ctx, fd) < 0) return 73;
    close(fd);
    seccomp_release(ctx);
    return 0;
}
