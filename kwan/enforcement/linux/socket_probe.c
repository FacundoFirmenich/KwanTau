#include <errno.h>
#include <stdio.h>
#include <string.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <unistd.h>

int main(void) {
    int fd = socket(AF_INET, SOCK_STREAM, 0);
    if (fd >= 0) {
        printf("socket_unexpectedly_allowed=1\n");
        close(fd);
        return 1;
    }
    printf("socket_errno=%d socket_error=%s\n", errno, strerror(errno));
    return errno == EPERM ? 0 : 2;
}
