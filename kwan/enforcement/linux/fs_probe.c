#include <errno.h>
#include <fcntl.h>
#include <stdio.h>
#include <string.h>
#include <unistd.h>

static int write_one(const char *path) {
    int fd = open(path, O_CREAT | O_WRONLY | O_TRUNC, 0600);
    if (fd < 0) return -errno;
    const char byte = 'x';
    if (write(fd, &byte, 1) != 1) { int e = errno; close(fd); return -e; }
    close(fd);
    return 0;
}

int main(int argc, char **argv) {
    if (argc != 3) return 64;
    int ro = write_one(argv[1]);
    int rw = write_one(argv[2]);
    printf("input_write=%d output_write=%d\n", ro, rw);
    if ((ro == -EACCES || ro == -EPERM || ro == -EROFS) && rw == 0) return 0;
    return 1;
}
