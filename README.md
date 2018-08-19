# service discovery
本项目是基于城云智慧云平台node中间层做的优化，目标是实现服务发现，以减少node与后端的耦合度，以及降低运维成本

## 构建步骤
```
# 1. git clone xxx
# 2. 使用vs code导入项目
# 3. 打开vs code的控制台, `npm install`
# 4. 浏览器输入`localhost:8084`,点击按钮调用微服务（前提是要让zookeeper先启动起来，并且让服务提供者想zookeeper注册服务）
    # 4.1 docker启动zookeeper，`docker run -d -p2181:2181 zookeeper`
    # 4.2 启动服务提供者程序向zookeeper注册服务，具体见 https://github.com/scutuyu/service-registry
```

## 技术栈
- node
- express
- async
- zookeeper

## 代码结构
```
├── README.md
├── app.js
├── package-lock.json
├── public
│   ├── 1.png
│   ├── README.md
│   ├── index.html
│   ├── js
│   │   └── jquery-2.2.3.min.js
│   └── stylesheets
│       └── style.css
└── src
    ├── common
    └── conf
        └── AppConfig.js
```

## 实现思路
使用同步，先连接zk服务器，连接成功之后，启动express web服务器；当有请求到达时，先检查缓存cache是否有服务提供者的地址，如果有，就将请求反向代理，如果代理失败，就将缓存清除，并返回500错误；
如果没有缓存，则扫描zookeeper指定目录下的服务提供者的临时子节点，并随机选择某个节点，获取其服务地址，然后将请求反向代理，最后将地址缓存到cache中

## 踩坑日志
1. 通过zk客户端查询子节点信息没有返回，原因是方法调用时少了括号，即zk.connect，应该是zk.connect()
2. 当有多个服务提供者时，客户端随机选择某个服务提供者，但是报错了，愿意是Math.random少写了括号，应该是Math.random()



## 不足
1. web服务启动时就会去连接zk服务器，如果zk服务器不可达，将会一直停在那里，web服务起不来
2. 当有多个服务提供者时，没有使用更好的负载均衡算法将请求分发给相对空闲的服务提供者

## 未来迭代计划
1. 当启动web服务的时候，依然先连接zk服务器，设置连接超时时间，超时后启动直接报错并退出
2. 使用更好的算法，比如：将用户请求根据用户的标识散列到某个服务提供者