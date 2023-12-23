---
title: kernel 保护机制
tags: [ctf-pwn,kernel]
date: 2022-12-22 13:38:00
categories: [ctf-pwn]
excerpt: smap smep
---

### SMAP SMEP

SMAP(Supervisor Mode Access Prevention，管理模式访问保护)

SMEP(Supervisor Mode Execution Prevention，管理模式执行保护)

目的是进制kernel态的cpu访问用户态的数据或者执行用户态的代码

#### 如何区分内核态和用户态

32位：0x0 ~ 0xbfffffff是用户态，0xc0000000~0xffffffff是内核态

64位：地址前16bit全0代表用户态，全f代表内核态

