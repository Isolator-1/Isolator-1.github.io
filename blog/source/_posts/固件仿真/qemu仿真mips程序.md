---
title: qemu的安装与仿真第一个mips程序
tags: [firmware analysis]
date: 2022-12-23 15:33:00
categories: [固件仿真]
excerpt: qemu的user-mode使用方法
---

#### QEMU安装

QEMU仿真程序分为两类：使用者模式（User Mode）、系统模式（System Mode）。区别在于User Mode只仿真单个程序，而System Mode仿真整个计算机系统，类似vmware

##### 使用者模式

安装：`sudo apt-get install qemu-user[-static]`

使用（以mips为例）：


```shell
cd <path-to-fsroot>
cp $(which qemu-mipsel-static) ./
sudo chroot . ./qemu-mipsel-static <path-to-elf>
```

对于32位小端序（LSB）程序，使用`qemu-mipsel`来仿真，32位MSB程序，使用`qemu-mips`来仿真

一个小端序的仿真示例：

![](/img/qemu/1.jpg)

> Q1：为什么要加 -static ？
>
> A1：xxx-static表示使用静态链接的qemu程序，不依赖外部动态链接程序，由于使用是要chroot改变根目录，原本的动态链接库会无法找到，除非使用ldd命令把所有依赖全都复制到新的根目录下，否则无法运行。
>
> 而且真的复制动态链接库过来可能会和原本存在的文件重名（我猜的，没验证过😅）

##### 系统模式

不管了，直接用fap（

见上一篇文章 <https://isolator-1.github.io/2022/12/17/CVE-2019-17621/>