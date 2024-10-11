---
title: Linux-Kernel#00
tags: [kernel]
date: 2024-07-27 21:11:00
categories: [学习笔记]
excerpt: linux kernel 学习笔记
---

## Introduction

看源码查符号的网站：https://elixir.bootlin.com/

源码包含如下内容

![](/img/学习笔记/Linux-Kernel/1.jpg)

- Documentation：文档，略
- arch：里面每一个文件夹都代表一个体系结构（比如x86，arm64），里面存放了所有和体系结构相关的代码
- block：里面包含“块设备”驱动程序的代码（比如SD卡、机械硬盘、固态硬盘就是块设备，叫块设备是因为只能以“块”为单位进行读写，与之相对的是字节设备驱动）
- crypto：存放许多加密、压缩、CRC校验等算法的源码
- drivers：包含linux内核设备驱动程序的源码，里面每一个文件夹都是一类设备（比如i2c、usb），驱动开发时要用到
- firmware：第三方设备驱动的固件（?)
- fs：各子文件夹内包含不同文件系统的实现（比如squashfs），外面还有一些共用的代码（比如挂载文件系统）
- include：和arch/.../内的include相对，这里存放和平台无关的头文件
- init：包含了内核启动的代码，`init/main.c`是包含其他各组件的内核核心代码
- ipc：进程间通讯的代码，比如信号量
- kernel：控制内核的代码
- lib：库函数，头文件的实现
- mm：内存管理代码
- net：网络协议代码
- scripts：编译内核的脚本
- security：访问控制（比如ACL）、权限管理、认证
- sound：声卡驱动
- tools：和内核交互的工具
- usr：早期用户空间代码
- virt：存放kvm的代码



## Compile kernel

一个ubuntu14.04，kernel版本是4.4.0

```
ubuntu@ubuntu:~$ uname -r
4.4.0-142-generic
```

去下一个4.1.1的kernel（https://www.kernel.org/）

https://cdn.kernel.org/pub/linux/kernel/v4.x/linux-4.1.1.tar.gz

解压，进入，`make menuconfig`配置编译选项，保存到`.config`

` make -j$(nproc) bzImage`，编译生成内核镜像

结束之后提示生成了一个`./arch/x86/boot/bzImage`，但是在x86_64的相同路径下也有一个bzImage，一看发现x86_64这个是x86的那个符号链接。

bzImage是压缩后的内核文件（即压缩后的vmlinux，vmlinux生成在根目录下）



## Simulation

有了kernel的bzImage，还需要一个磁盘文件，才能用qemu仿真

依旧是下载（https://busybox.net/），解压，然后`make menuconfig`

配置里勾选`Settings  ->   [*] Build static binary (no shared libs) `

创建一个名为fs的镜像并挂载到当前机器上，将编译的busybox写入到镜像中，并且补上proc dev等一些目录

```bash
dd if=/dev/zero of=rootfs.img bs=1M count=10
mkfs.ext4 rootfs.img
mkdir fs

sudo mount -t ext4 -o loop rootfs.img ./fs
sudo make install CONFIG_PREFIX=./fs

cd fs
sudo mkdir proc dev etc home mnt
sudo cp -r ../examples/bootfloppy/etc/* etc/

cd ..
sudo chmod -R 777 fs/
sudo umount fs
```



安装qemu系统仿真

```
sudo apt-get install qemu-system-x86
qemu-system-x86_64
```



```bash
qemu-system-x86_64 -kernel ./linux-4.1.1/arch/x86/boot/bzImage -hda ./busybox-1.28.4/rootfs.img -append "root=/dev/sda console=ttyS0" -nographic
```

指定kernel，文件系统，无图形界面，将输入输出重定向到当前命令行中

![](/img/学习笔记/Linux-Kernel/2.jpg)

内核版本是编译i的4.1.1

`ctrl A ` + `X` 退出qemu



## Patch Kernel

修改`./arch/x86/syscalls/syscall_64.tbl`文件，添加一个新的syscall

> 在[这篇文章](https://arttnba3.cn/2021/02/21/OS-0X01-LINUX-KERNEL-PART-II/#1-%E5%88%86%E9%85%8D%E7%B3%BB%E7%BB%9F%E8%B0%83%E7%94%A8%E5%8F%B7)写的路径是arch/x86/entry/syscalls/syscall_64.tbl，去看了一下，5.x版本就多了一层叫做entry的目录

```
1000	64	mytestsyscall		sys_mytestsyscall
```

在`include/linux/syscalls.h`中声明这个系统调用

```c
asmlinkage long sys_mytestsyscall(void);
```

在`kernel/sys.c`中实现这个函数

```C
SYSCALL_DEFINE0(mytestsyscall)
{
    printk("syscall 1000 called.\n\n");
    return 0;
}
```



## Replace Kernel

编译出bzImage之后

```
sudo make modules
sudo make modules_install
sudo make install
sudo update-initramfs -c -k 4.1.1
sudo update-grub
sudo apt-get install linux-source
```

在`/etc/default/grub`里设置一下，开机时长按shift进入切换kernel的界面，切换内核到4.1.1

![](/img/学习笔记/Linux-Kernel/3.png)

```
ubuntu@ubuntu:~$ uname -r
4.1.1
```



测试一下之前添加的syscall

```c
#include <unistd.h>
int main()
{
    syscall(1000);
    return 0;
}
```

```
ubuntu@ubuntu:~$ dmesg | grep "syscall 1000"
[  509.690784] syscall 1000 called.
```



