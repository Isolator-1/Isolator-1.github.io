---
title: VxWorks固件函数符号恢复、固件加载地址识别
tags: [firmware analysis]
date: 2023-05-12 14:01:00
categories: [固件仿真]
excerpt: CTF_HUB 某嵌入式设备固件升级包
---

### 固件提取

![](/img/VxWorks/1.jpg)

参考文章 [CTFHUB-WriteUp](https://writeup.ctfhub.com/Challenge/2020/%E5%B7%A5%E4%B8%9A%E4%BF%A1%E6%81%AF%E5%AE%89%E5%85%A8%E6%8A%80%E8%83%BD%E5%A4%A7%E8%B5%9B/%E6%B5%8E%E5%8D%97%E7%AB%99/pka8PC6FDDQC7A8Nk5yYNS.html)

binwalk提取出名为385的固件，确定是VxWorks内核，并且带有符号表

![](/img/VxWorks/2.jpg)

然后用binwalk -A 确定架构和大小端

![](/img/VxWorks/3.jpg)

### 符号表

从binwalk结果可以看出符号表在`0x301E74`附近（这不一定是真实值）

![](/img/VxWorks/4.jpg)

VxWorks符号表每一项由4部分组成，0-3字节是4个`00`，4-7字节是符号字符串所在内存地址，8-11是符号对应的内容所在地址，12-15字节表示这是一个什么类型的符号。

如上图，这是一个符号地址在`0x27655C`，内容在`0x1FF058`，类型为函数（0x500）的一个符号

函数名字

writeup里说可以在这两个地址上直接看到对应的内容，但我的ida里这两个地址上的东西显然不对。。。暂留问题

（并且ida直接加载我这里一个函数都没有，不知道和writeup使用的差别在哪...）

