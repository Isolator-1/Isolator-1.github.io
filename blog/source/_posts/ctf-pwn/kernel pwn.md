---
title: kernel pwn
tags: [ctf-pwn,kernel]
date: 2023-12-19 13:40:00
categories: [ctf-pwn]
excerpt: kernel pwn

---

前置知识见[这篇](https://isolator-1.github.io/2023/12/13/%E5%AD%A6%E4%B9%A0%E7%AC%94%E8%AE%B0/OS/)，记录了控制流转移和cred的相关内容

### 镜像格式

`bzImage` ：适用于大于512kB的kernel，开头自带gzip的解压代码

`zImage` ：小于512kB的kernel

`vmlinux` ：静态链接的linux kernel可执行文件，压缩之后（添加解压代码）为`vmlinuz`，即`bzImage`或`zImage`





