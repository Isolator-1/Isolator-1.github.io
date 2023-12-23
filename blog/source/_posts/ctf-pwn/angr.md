---
title: angr
tags: [ctf-pwn,angr]
date: 2023-12-23 14:01:00
categories: [ctf-pwn]
excerpt: angr & pwn
---

今天也是看大佬博客学习的一天（😶‍🌫️😶‍🌫️😶‍🌫️

### angr的安装

```bash
sudo apt-get install gcc-multilib
pip install angr
```

安装之后import进来报错找不到pycparser.ply，查了半天没搞懂

果断从kali换成ubuntu20.04，好了（😥

### angr-ctf

教你如何打ctf的时候用angr偷🐤

```
git clone https://github.com/jakespringer/angr_ctf.git
```

### 00 搜索可达路径

~~让你不用再逆向加密程序（~~

打开00_angr_find

```bash
./generate.py 114514 00_angr_find
```

查看生成的程序

```c
int __cdecl main(int argc, const char **argv, const char **envp)
{
  int i; // [esp+1Ch] [ebp-1Ch]
  char s1[9]; // [esp+23h] [ebp-15h] BYREF
  unsigned int v6; // [esp+2Ch] [ebp-Ch]

  v6 = __readgsdword(0x14u);
  printf("Enter the password: ");
  __isoc99_scanf("%8s", s1);
  for ( i = 0; i <= 7; ++i )
    s1[i] = complex_function(s1[i], i);
  if ( !strcmp(s1, "XFQUUEQF") )
    puts("Good Job.");
  else
    puts("Try again.");
  return 0;
}
```

目的是让s1和那个字符串相等，输出Good Job。开始用angr符号执行

首先选择输出Good Job的代码地址，0x080492F3，让angr自动帮我们探索到达这个地方的路径

```python
import angr
import sys
def solver():
    bin_path = './00_angr_find'
    proj = angr.Project(bin_path) # load the binary file
    init_state = proj.factory.entry_state() # create an empty context
    simgr = proj.factory.simgr(init_state) # create a simulator_manager
    obj_path_addr = 0x80492F3 # the path we'd like to explore
    simgr.explore(find = obj_path_addr) # start to explore

    if simgr.found :
        solution_state = simgr.found[0]
        # print the input that solve the constraint
        print(solution_state.posix.dumps(sys.stdin.fileno()).decode())
    else :
        raise Exception('Could not find the solution')
if __name__ == '__main__':
    solver()
```

```bash
ubuntu@ubuntu:~/Desktop/angr_ctf/00_angr_find$ python exp.py 
......（一堆warning）
XCKLIPYK
ubuntu@ubuntu:~/Desktop/angr_ctf/00_angr_find$ vim exp.py 
ubuntu@ubuntu:~/Desktop/angr_ctf/00_angr_find$ ./00_angr_find 
Enter the password: XCKLIPYK
Good Job.
```



### 01 避免路径爆炸

main函数太大ida搞不出来图模式和c代码（第一次见🐖

直接找到提示输入的字符串，然后往下看，发现好多叫avoid me的函数，以及一个may be good 函数，may be good 函数里是一个分支，一边succ，一边try again。

成功的条件是should_succeed非0，然后s1===s2，而avoid me把should_succeed置零了

按上一题的方法试了一下，半天跑不出来，路径爆炸了

因此需要在explore时添加避开的路径

```python
avoid_path_addr = 0x80492BB
simgr.explore(find = obj_path_addr, avoid = avoid_path_addr) 
```

### 02 伪路径



搜字符串good job会发现有好多代码块，无法确定搜索到达哪一个

> **find 和 avoid 的参数不一定时某个地址，也可以是以状态为参数的一个函数**

```python
def find_path(state):
    return b'Good Job.' in state.posix.dumps(sys.stdout.fileno())
def avoid_path(state):
    return b'Try again.' in state.posix.dumps(sys.stdout.fileno())
def solve():
    bin_path = './02_angr_find_condition'
    proj = angr.Project(bin_path)
    init_state = proj.factory.entry_state()
    simgr = proj.factory.simgr(init_state)
    simgr.explore(find = find_path, avoid = avoid_path)
    if simgr.found:
        solution_state = simgr.found[0]
        print(solution_state.posix.dumps(sys.stdin.fileno()).decode())
    else:
        raise Exception('Could not find the solution')
if __name__ == '__main__':
    solve()
```



### 03 Claripy 求解

通过claripy创建变量的常见用法

创建

```python
# 具体值的变量
bvv = claripy.BVV(int_value, size_in_bits)
bvv = claripy.BVV(string_value)
# 符号变量
bvs = claripy.BVS("x", 64)
```

零扩展

```python
bvv = bvv.zero_extend(32)
```

运算

```python
bvs3 = (bvs * bvs2 + bvv) / bvs
.op 可以查看运算类型，.args可以查看运算的参数（应该都是最上层的那个运算）
```

由于bit数是固定的，需要注意overflow

