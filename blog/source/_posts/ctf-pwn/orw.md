---
title: orw
tags: [ctf-pwn]
date: 2023-10-18 18:11:00
categories: [ctf-pwn]
excerpt: 沙箱保护机制
---











##### 安装seccomp

```shell
sudo apt install gcc ruby-dev
gem install seccomp-tools
```

![](/img/orw/1.jpg)

evecve被禁用了，system同样不行（因为也是调用的execve）

##### 题目

https://buuoj.cn/challenges#pwnable_orw

