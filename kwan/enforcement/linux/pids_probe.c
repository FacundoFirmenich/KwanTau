#include <errno.h>
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <sys/wait.h>
#include <unistd.h>

int main(void) {
    pid_t children[128];
    int n = 0;
    int blocked_errno = 0;
    for (int i = 0; i < 128; ++i) {
        pid_t p = fork();
        if (p == 0) { pause(); _exit(0); }
        if (p < 0) { blocked_errno = errno; break; }
        children[n++] = p;
    }
    for (int i = 0; i < n; ++i) kill(children[i], SIGKILL);
    for (int i = 0; i < n; ++i) waitpid(children[i], NULL, 0);
    printf("forked=%d blocked_errno=%d\n", n, blocked_errno);
    return (blocked_errno == EAGAIN && n < 128) ? 0 : 1;
}
