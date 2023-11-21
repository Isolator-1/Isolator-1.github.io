---
title: multilayer perceptrons
tags: [pytorch]
date: 2023-11-19 00:16:00
categories: [pytorch]
excerpt: ai基础知识补习
---

```python
import torch
from torch import nn
from torchvision import transforms
import torchvision
from torch.utils import data
```


```python
net = nn.Sequential(nn.Flatten(), 
                    nn.Linear(784,256), 
                    nn.ReLU(),
                    nn.Linear(256,10))
```


```python
batch_size = 256
lr = 0.1
num_epochs = 10
loss = nn.CrossEntropyLoss(reduction='none')
trainer = torch.optim.SGD(net.parameters(), lr=lr)
```


```python
def get_dataloader_workers():  #@save
    return 4
def load_data_fashion_mnist(batch_size, resize=None): 
    trans = [transforms.ToTensor()]
    if resize:
        trans.insert(0, transforms.Resize(resize))
    trans = transforms.Compose(trans)
    mnist_train = torchvision.datasets.FashionMNIST(
        root="./data", train=True, transform=trans, download=True)
    mnist_test = torchvision.datasets.FashionMNIST(
        root="./data", train=False, transform=trans, download=True)
    return (
            data.DataLoader(mnist_train, batch_size, shuffle=True, num_workers=get_dataloader_workers()),
            data.DataLoader(mnist_test, batch_size, shuffle=False, num_workers=get_dataloader_workers())
           )
train_iter, test_iter = load_data_fashion_mnist(batch_size)
```


```python
# 不重要，不用看
class Accumulator:  
    """在n个变量上累加"""
    def __init__(self, n):
        self.data = [0.0] * n

    def add(self, *args):
        self.data = [a + float(b) for a, b in zip(self.data, args)]

    def reset(self):
        self.data = [0.0] * len(self.data)

    def __getitem__(self, idx):
        return self.data[idx]
def accuracy(y_hat, y):  #@save
    """计算预测正确的数量"""
    if len(y_hat.shape) > 1 and y_hat.shape[1] > 1:
        y_hat = y_hat.argmax(axis=1)
    cmp = y_hat.type(y.dtype) == y
    return float(cmp.type(y.dtype).sum())
def evaluate_accuracy(net, data_iter):  
    """计算在指定数据集上模型的精度"""
    if isinstance(net, torch.nn.Module):
        net.eval()  # 将模型设置为评估模式
    metric = Accumulator(2)  # 正确预测数、预测总数
    with torch.no_grad():
        for X, y in data_iter:
            metric.add(accuracy(net(X), y), y.numel())
    return metric[0] / metric[1]

def train_epoch_ch3(net, train_iter, loss, updater):  #@save
    """训练模型一个迭代周期（定义见第3章）"""
    # 将模型设置为训练模式
    if isinstance(net, torch.nn.Module):
        net.train()
    # 训练损失总和、训练准确度总和、样本数
    metric = Accumulator(3)
    for X, y in train_iter:
        # 计算梯度并更新参数
        y_hat = net(X)
        l = loss(y_hat, y)
        if isinstance(updater, torch.optim.Optimizer):  # 这次就是true了
            # 使用PyTorch内置的优化器和损失函数
            updater.zero_grad()
            l.mean().backward()
            updater.step()
        else:
            # 使用定制的优化器和损失函数
            l.sum().backward()
            updater(X.shape[0])
        metric.add(float(l.sum()), accuracy(y_hat, y), y.numel())
    # 返回训练损失和训练精度
    return metric[0] / metric[2], metric[1] / metric[2]
def train_ch3(net, train_iter, test_iter, loss, num_epochs, updater):  #@save
    """训练模型（定义见第3章）"""
    for epoch in range(num_epochs):
        train_metrics = train_epoch_ch3(net, train_iter, loss, updater)
        train_loss, train_acc = train_metrics
        print(f'epoch {epoch + 1}, loss {train_loss:f}, acc {train_acc:f}')
```


```python
train_ch3(net, train_iter, test_iter, loss, num_epochs, trainer)
```

    epoch 1, loss 0.869232, acc 0.711650
    epoch 2, loss 0.558885, acc 0.805100
    epoch 3, loss 0.494192, acc 0.828150
    epoch 4, loss 0.463008, acc 0.837517
    epoch 5, loss 0.441443, acc 0.844883
    epoch 6, loss 0.417930, acc 0.853567
    epoch 7, loss 0.403445, acc 0.858967
    epoch 8, loss 0.394371, acc 0.860567
    epoch 9, loss 0.382370, acc 0.865217
    epoch 10, loss 0.372356, acc 0.867917

