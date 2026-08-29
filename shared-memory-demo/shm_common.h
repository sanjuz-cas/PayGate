#ifndef SHM_COMMON_H
#define SHM_COMMON_H

/* Name of the shared memory object.
 * Windows: named file mapping (visible in the session namespace).
 * POSIX:   shm object created under /dev/shm (Linux) or /var/run (macOS). */
#if defined(_WIN32)
  #define SHM_NAME "Local\\PayGateShmDemo"
#else
  #define SHM_NAME "/paygate_shm_demo"
#endif

#define SHM_TEXT_SIZE 256

/* The structure both processes map into their own address space. */
typedef struct {
    volatile long has_message; /* 1 = a new message is available          */
    volatile long writer_done; /* 1 = writer finished, reader may exit    */
    char          text[SHM_TEXT_SIZE];
} shm_data_t;

#endif /* SHM_COMMON_H */