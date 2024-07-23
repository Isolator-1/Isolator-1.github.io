---
title: linear regression 
tags: [pytorch]
date: 2023-11-19 01:00:00
categories: [pytorch]
excerpt: ai基础知识补习
---

### 1  自己写loss optim nn.Sequential dataloader

```python
import random
import torch
from d2l import torch as d2l
```


```python
def synthetic_data(w,b,num_examples):
    X = torch.normal(0,1,(num_examples, len(w)))
    y = torch.matmul(X,w) + b
    y += torch.normal(0,0.01,y.shape)
    return X, y.reshape((-1,1))
```


```python
true_w = torch.tensor([2,-3.4], dtype=torch.float)
true_b = 4.2
features, labels = synthetic_data(true_w, true_b, 1000)
print('features:', features[0], '\nlabel:', labels[0])
print(features.size(),labels.size())
```

    features: tensor([ 0.9487, -1.4700]) 
    label: tensor([11.1058])
    torch.Size([1000, 2]) torch.Size([1000, 1])



```python
d2l.set_figsize()
d2l.plt.scatter(features[:,(1)].detach().numpy(), labels.detach().numpy(), 1)
```




    <matplotlib.collections.PathCollection at 0x253ff824790>




​    
![svg](/img/AI/linear%20regression_files/linear%20regression_3_1.svg)
​    



```python
def data_iter(batch_size, features, labels): 
    num_examples = len(features) # 1000
    indices = list(range(num_examples)) 
    random.shuffle(indices)
    for i in range(0, num_examples, batch_size):
        batch_indices = torch.tensor(indices[i: min(i+batch_size, num_examples)])
        yield features[batch_indices], labels[batch_indices]
batch_size = 10
for X,y in data_iter(batch_size, features, labels):
    print(X, '\n', y)
    break
```

    tensor([[ 0.4883, -0.0929],
            [ 0.4926,  0.9515],
            [ 0.8701, -1.2666],
            [-1.8409,  1.4006],
            [ 0.6684, -1.6310],
            [ 1.0021, -0.7984],
            [ 0.0086, -0.8899],
            [-0.8791,  0.2551],
            [-0.0785,  0.6714],
            [ 0.6666, -0.6967]]) 
     tensor([[ 5.4957],
            [ 1.9405],
            [10.2555],
            [-4.2457],
            [11.0663],
            [ 8.9186],
            [ 7.2409],
            [ 1.5641],
            [ 1.7715],
            [ 7.9071]])



```python
w = torch.normal(0, 0.01, size=(2,1), requires_grad=True)
b = torch.zeros(1, requires_grad=True)
```


```python
def linreg(X, w, b):
    return torch.matmul(X,w) + b
```


```python
def squared_loss(y_hat, y):
    return (y_hat - y.reshape(y_hat.shape)) ** 2 / 2
```


```python
def sgd(params, lr, batch_size):
    with torch.no_grad():
        for param in params:
            param -= lr * param.grad /batch_size
            param.grad.zero_()
```


```python
lr = 0.03
num_epochs = 3
net = linreg
loss = squared_loss
```


```python
for epoch in range(num_epochs):
    for X,y in data_iter(batch_size, features, labels):
        l = loss(net(X,w,b),y)
        l.sum().backward()
        sgd([w,b] , lr, batch_size)
    with torch.no_grad():
        train_l = loss(net(features, w, b), labels)
        print(f'epoch {epoch + 1}, loss {float(train_l.mean()):f}')
```

    epoch 1, loss 0.027771
    epoch 2, loss 0.000104
    epoch 3, loss 0.000055



```python
print(f'w的估计误差: {true_w - w.reshape(true_w.shape)}')
print(f'b的估计误差: {true_b - b}')
```

    w的估计误差: tensor([ 0.0012, -0.0005], grad_fn=<SubBackward0>)
    b的估计误差: tensor([0.0006], grad_fn=<RsubBackward1>)







### 2 全部换成pytorch



```python
import numpy as np
import torch
from torch.utils import data
from d2l import torch as d2l
```


```python
true_w = torch.tensor([2, -3.4])
true_b = 4.2
features, labels = d2l.synthetic_data(true_w, true_b, 1000)
print(features.shape, labels.shape)
```

    torch.Size([1000, 2]) torch.Size([1000, 1])



```python
def load_array(data_arrays, batch_size ,is_train=True):
    dataset = data.TensorDataset(*data_arrays)
    return data.DataLoader(dataset, batch_size, shuffle=is_train)
```


```python
batchsize = 10
data_iter = load_array((features, labels), batchsize)
next(iter(data_iter))
```




    [tensor([[ 0.5940, -1.2375],
             [-0.0840, -0.2979],
             [-0.6866, -0.0931],
             [-0.7088,  1.3270],
             [ 1.0423,  0.6539],
             [ 0.8156,  0.4527],
             [ 0.5195, -0.3563],
             [ 1.5992, -0.2122],
             [ 0.9235,  0.7968],
             [ 1.7633,  1.0517]]),
     tensor([[ 9.6162],
             [ 5.0296],
             [ 3.1477],
             [-1.7288],
             [ 4.0441],
             [ 4.2969],
             [ 6.4594],
             [ 8.1204],
             [ 3.3252],
             [ 4.1758]])]




```python
from torch import nn
net = nn.Sequential(nn.Linear(2,1))
net[0].weight.data.normal_(0,0.01)
net[0].bias.data.fill_(0)
```




    tensor([0.])




```python
loss = nn.MSELoss()
trainer = torch.optim.SGD(net.parameters(), lr = 0.03)
```


```python
num_epochs = 3
for epoch in range(num_epochs):
    for X, y in data_iter:
        l = loss(net(X) ,y)
        trainer.zero_grad()
        l.backward()
        trainer.step()
    l = loss(net(features), labels)
    print(f'epoch {epoch + 1}, loss {l:f}')
```

    epoch 1, loss 0.000310
    epoch 2, loss 0.000098
    epoch 3, loss 0.000098



```python
w = net[0].weight.data
print('w的估计误差：', true_w - w.reshape(true_w.shape))
b = net[0].bias.data
print('b的估计误差：', true_b - b)
```

    w的估计误差： tensor([0.0002, 0.0010])
    b的估计误差： tensor([0.0007])



```python
print(net)
```

    Sequential(
      (0): Linear(in_features=2, out_features=1, bias=True)
    )



```python
w_grad = net[0].weight.grad
print('w的梯度：', w_grad)
b_grad = net[0].bias.grad
print('b的梯度：', b_grad)
```

    w的梯度： tensor([[0.0019, 0.0058]])
    b的梯度： tensor([0.0047])

