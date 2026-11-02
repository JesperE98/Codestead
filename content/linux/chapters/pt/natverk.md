# Redes

Quase tudo o que um computador Linux faz envolve conversar com outros
computadores: baixar atualizações, mostrar páginas da web, fazer login em
servidores. Quando algo dá errado, o terminal tem as melhores ferramentas para
descobrir o porquê. Neste capítulo você vai aprender a encontrar o seu próprio
endereço, testar conexões, consultar nomes, ver quais serviços estão rodando,
baixar coisas da web e fazer login em outro computador com SSH.

O computador simulado fica em uma pequena rede doméstica:

| Computador | Endereço | O quê |
|---|---|---|
| O seu computador (`ubuntu`) | `192.168.1.42` | Onde você está agora |
| O roteador (gateway) | `192.168.1.1` | A conexão para fora, com a internet |
| O servidor | `192.168.1.10` | Outro computador Linux em que você pode fazer login |

Atrás do roteador existe uma "internet" com, entre outros, `example.com`,
`linux.org` e `archlinux.org`.

## Endereços IP

Todo computador em uma rede tem um **endereço IP**. Um endereço IPv4 são
quatro números entre 0 e 255, por exemplo `192.168.1.42`. Endereços que
começam com `192.168.`, `10.` ou `172.16.`–`172.31.` são **privados** – eles
só são usados dentro de redes locais e nunca aparecem lá fora, na internet.

O comando para mostrar os endereços do computador é o `ip` (do pacote
*iproute2*). `ip addr` pode ser abreviado para `ip a`:

```sh
ip a
```

Você vê duas **interfaces** (placas de rede):

- `lo` – *loopback*, uma placa de faz de conta que o computador usa para
  conversar consigo mesmo.
- `enp0s3` – a placa de rede de verdade. Antigamente as placas se chamavam
  `eth0`, e placas sem fio costumam ter nomes como `wlan0` ou `wlp2s0`.

A linha `inet 192.168.1.42/24` é o seu endereço IPv4. `link/ether` é o
**endereço MAC** da placa, que vem gravado no hardware, e `state UP` significa
que a placa está funcionando. Para uma visão mais curta existe o `-br`
(*brief*), e `hostname -I` mostra só os endereços:

```sh
ip -br a
hostname -I
```

```try
ip -br a
---
Uma linha por interface: o nome, o estado (`UP`) e os endereços.
```

Você ainda vai ver o comando mais antigo `ifconfig` (do pacote *net-tools*)
em muitos tutoriais, mas ele não vem instalado por padrão nas distribuições
modernas. O `ip` faz tudo o que ele fazia e mais.

## localhost – o próprio computador

O endereço `127.0.0.1` tem o nome **localhost** e sempre significa "este
computador". Programas no mesmo computador muitas vezes conversam entre si
pelo localhost – por exemplo, um servidor web que você está desenvolvendo e o
navegador com que você o testa. O tráfego para o localhost nunca sai do
computador.

## Máscara de rede e gateway

O `/24` depois do endereço é a **máscara de rede**. Ela diz que os primeiros
24 bits (os três primeiros números, `192.168.1`) são o endereço da rede.
Todos os computadores cujo endereço começa com `192.168.1.` estão na mesma
rede local e podem ser alcançados diretamente. Todo o resto é enviado para o
**gateway** – o roteador –, que repassa para a internet. Você pode ver isso na
tabela de roteamento:

```sh
ip route
```

```text
default via 192.168.1.1 dev enp0s3 proto dhcp src 192.168.1.42 metric 100
192.168.1.0/24 dev enp0s3 proto kernel scope link src 192.168.1.42 metric 100
```

A primeira linha, **default**, é a rota padrão: "tudo o que não está listado
em outro lugar vai para 192.168.1.1". A segunda linha diz que a rede inteira
`192.168.1.0/24` é alcançada diretamente pela `enp0s3`. `proto dhcp`
significa que o computador recebeu as configurações automaticamente do
roteador via **DHCP**.

```quiz
O seu computador tem o endereço `192.168.1.42/24`. Quais endereços ele
consegue alcançar diretamente, sem passar pelo gateway?
- [x] `192.168.1.10`
- [x] `192.168.1.1`
- [ ] `192.168.2.10`
- [ ] `1.1.1.1`
---
Com `/24`, os três primeiros números são o endereço da rede. Tudo o que começa
com `192.168.1.` está na mesma rede local – todo o resto vai pela rota padrão
até o gateway.
```

```predict
$ ip route | grep default | awk '{print $3}'
192.168.1.1
---
A terceira palavra na linha `default` é o endereço do gateway.
```

## ping – dá para alcançar?

O `ping` envia pequenos pacotes de teste e mede quanto tempo as respostas
levam. Com `-c` (*count*) você escolhe quantos pacotes – senão o ping continua
até você apertar **Ctrl+C**:

```sh
ping -c 3 192.168.1.1
```

```text
64 bytes from 192.168.1.1: icmp_seq=1 ttl=64 time=0.756 ms
...
3 packets transmitted, 3 received, 0% packet loss, time 2004ms
```

- `time=` é o tempo de resposta. Dentro da rede doméstica, menos de um
  milissegundo; para fora, na internet, muitas vezes 10–50 ms.
- `0% packet loss` – nenhum pacote se perdeu. Pacotes perdidos indicam uma
  rede ruim (ou uma conexão Wi-Fi ruim).
- `Destination Host Unreachable` significa que nenhum computador na rede
  local tem aquele endereço.

Experimente também pingar o próprio computador e um computador lá fora, na
internet:

```sh
ping -c 2 localhost
ping -c 3 example.com
```

Atenção! Muitos servidores e firewalls deliberadamente não respondem ao ping.
Então, ficar sem resposta nem sempre significa que o computador está fora do
ar.

## Nomes e DNS

Pessoas lembram de nomes, computadores usam endereços. O **DNS** (*Domain
Name System*) é a lista telefônica da internet, que traduz `example.com` em um
endereço IP. Qual servidor DNS o computador consulta está escrito em
`/etc/resolv.conf`:

```sh
cat /etc/resolv.conf
```

No Ubuntu aparece `127.0.0.53` – esse é o **systemd-resolved**, um
intermediário local no seu próprio computador que, por sua vez, consulta o
roteador. Algumas outras distribuições mostram o roteador, `192.168.1.1`,
diretamente.

Para consultar o DNS você mesmo, use `dig`, `host` ou `nslookup`. Eles não vêm
instalados de início. No Ubuntu, eles vêm no pacote `dnsutils` (outras
famílias dão outro nome ao pacote):

```sh
sudo apt update
sudo apt install dnsutils
```

O `dig` mostra a resposta inteira do servidor DNS. A parte importante fica sob
`ANSWER SECTION`. Com `+short` você recebe só o endereço:

```sh
dig example.com
dig +short example.com
```

`host` e `nslookup` fazem o mesmo com uma saída mais curta. O `nslookup`
também existe no Windows e no macOS. O `host` também sabe fazer uma
**consulta reversa** – de endereço para nome:

```sh
host example.com
nslookup archlinux.org
host 1.1.1.1
```

Você pode consultar um servidor DNS específico com `@`, por exemplo o
`1.1.1.1` da Cloudflare ou o `8.8.8.8` do Google:

```sh
dig @8.8.8.8 +short debian.org
```

## /etc/hosts – a lista de nomes do próprio computador

Antes de consultar o DNS, o computador olha no arquivo `/etc/hosts`. Entre
outras coisas, ali está escrito que `localhost` é `127.0.0.1`:

```sh
cat /etc/hosts
```

O servidor da rede doméstica tem o endereço `192.168.1.10`, mas o nome
`server.lan` não está em nenhum DNS:

```sh
ping -c 1 server.lan
```

A solução é adicionar uma linha ao `/etc/hosts`. O arquivo pertence ao root,
então você precisa de `sudo`. Mas cuidado – isto **não** funciona:

```text
sudo echo '192.168.1.10 server.lan' >> /etc/hosts
bash: /etc/hosts: Permission denied
```

O `sudo` vale só para o `echo`. Quem abre o arquivo para o `>>` é o seu
próprio shell (que roda como você, não como root). O truque é o `tee -a`, que
acrescenta ao final de um arquivo o que recebe pelo pipe – e o `tee` pode ser
executado com sudo:

```sh
echo '192.168.1.10 server.lan' | sudo tee -a /etc/hosts
ping -c 3 server.lan
```

Agora o nome funciona para todos os programas do computador. Mas o `dig`
consulta o DNS diretamente e ignora o `/etc/hosts`, então ele continua não
encontrando nada. Para ver o que o *sistema* resolve, use o `getent`:

```sh
dig +short server.lan
getent hosts server.lan
```

A ordem (primeiro o arquivo, depois o DNS) é definida pela linha `hosts:` em
`/etc/nsswitch.conf`.

```quiz
Por que `sudo echo '192.168.1.10 server.lan' >> /etc/hosts` dá
*Permission denied*?
- [ ] O `echo` não pode ser executado com sudo
- [x] É o seu próprio shell, e não o root, que abre o arquivo para o `>>` – o sudo só vale para o `echo`
- [ ] O `/etc/hosts` não pode ser alterado, nem pelo root
- [ ] O `>>` só funciona em arquivos no seu diretório pessoal
---
É por isso que se usa `echo ... | sudo tee -a /etc/hosts`: aí é o `tee`,
rodando como root, que abre o arquivo.
```

## Portas e serviços

Um endereço IP aponta para um computador. Uma **porta** (um número entre 1 e
65535) aponta para um programa naquele computador – como o endereço de um
prédio e o número do apartamento. Diz-se que um programa que espera conexões
está **escutando** em uma porta. Algumas conhecidas:

| Porta | Serviço |
|---|---|
| 22 | SSH – fazer login em outros computadores |
| 53 | DNS |
| 80 | HTTP – web |
| 443 | HTTPS – web criptografada |
| 8080 | Muitas vezes servidores web durante o desenvolvimento |

Só o root pode abrir portas abaixo de 1024. O `ss` (*socket statistics*)
mostra quais portas estão escutando:

```sh
ss -tulpn
```

As flags costumam ser decoradas como uma ladainha: **t**cp, **u**dp,
**l**istening, **p**rocess, **n**umeric. `0.0.0.0:22` significa que o `sshd`
escuta na porta 22 em todos os endereços do computador, e `[::]:22` é o mesmo
para IPv6. A coluna *Process* fica vazia para processos de outros usuários –
com `sudo` você vê todos:

```sh
sudo ss -tulpn
```

Se o servidor de treino `myserver` do capítulo de processos estiver rodando,
você o vê aqui na porta 8080. O comando mais antigo `netstat -tulpn` (do
*net-tools*) faz a mesma coisa.

## Baixando da web: curl e wget

O `curl` busca o que estiver em um endereço (uma **URL**) e imprime no
terminal. Experimente com o myserver no seu próprio computador:

No Ubuntu o `curl` não vem pré-instalado (mas o `wget` vem):

```sh
sudo apt install curl
```

```sh
curl http://localhost:8080
```

Recebeu `Couldn't connect to server`? Então nada está escutando na porta –
talvez você tenha parado o myserver no capítulo de processos. Inicie-o de
novo:

```sh
myserver
```

Com `-I` o curl mostra só os **cabeçalhos** (*headers*) da resposta, em que a
primeira linha é um **código de status**:

```sh
curl -I https://example.com
```

| Código | Significa |
|---|---|
| 200 | OK |
| 301, 302 | A página mudou de lugar – veja `Location:` |
| 403 | Proibido |
| 404 | Não encontrado |
| 500 | Erro no servidor |

Muitos sites redirecionam de `http://` para `https://`. Aí você só recebe um
curto "301 Moved Permanently". Com `-L` o curl segue o redirecionamento:

```sh
curl -I http://linux.org
curl -L http://linux.org
```

Como o curl escreve no terminal, ele funciona muito bem em um pipe. O `-s`
(*silent*) desliga o indicador de progresso:

```sh
curl -s https://example.com | grep title
```

Para salvar em um arquivo, use `-o ARQUIVO` (ou `-O`, que tira o nome do
arquivo do endereço):

```sh
cd ~
curl -o {{exampleHtml}} https://example.com
```

O `wget` foi feito para baixar arquivos. Ele sempre salva em um arquivo,
mostra o progresso e segue redirecionamentos por conta própria:

```sh
wget https://example.com/cheatsheet.txt
cat cheatsheet.txt
```

Para escolher você mesmo o nome do arquivo, use o `-O` maiúsculo:
`wget -O file.html URL`.

## SSH – fazendo login em outro computador

O **SSH** (*Secure Shell*) é a forma habitual de controlar um computador
Linux remotamente, e tudo o que é enviado vai criptografado. O servidor roda o
serviço `sshd` na porta 22, e você se conecta com o cliente `ssh`:

```sh
ssh {{user}}@server.lan hostname
```

`{{user}}@server.lan` significa "o usuário {{user}} no computador server.lan". O
comando depois do host (`hostname`) roda no servidor e a resposta aparece
aqui – ela diz `server`, não `ubuntu`.

Na primeira vez que você se conecta a um computador, o ssh pergunta se você
confia nele:

```text
The authenticity of host 'server.lan (192.168.1.10)' can't be established.
ED25519 key fingerprint is SHA256:q7Jx3MmP0yZk8VbW1sTn4dLr9HcE2uFgA6oYiKjN5Rw.
Are you sure you want to continue connecting (yes/no/[fingerprint])?
```

Digite `yes` (a palavra inteira). A **chave do host** (*host key*) do servidor
é então salva em `~/.ssh/known_hosts`. Se a chave mudar mais tarde, o ssh dá
um aviso bem chamativo – pode significar que alguém está se passando pelo
servidor.

O comando pode ser vários comandos entre aspas:

```sh
ssh {{user}}@server.lan 'whoami; uptime; ls'
ssh {{user}}@server.lan cat {{welcomeFile}}
```

Sem um comando, o ssh faz login e você recebe um shell no outro computador,
de onde você sai com `exit`. Isso não é suportado no simulador – lá você
sempre escreve o comando logo depois do host.

### Chaves em vez de senhas

Em vez de uma senha, você pode fazer login com um **par de chaves**. A chave
privada fica com você, e a pública é colocada no servidor:

```sh
ssh-keygen
ssh-copy-id {{user}}@server.lan
```

Aperte Enter nas perguntas do `ssh-keygen` para usar o arquivo padrão
`~/.ssh/id_ed25519` sem frase secreta (*passphrase*). O `ssh-copy-id`
adiciona a chave pública (`id_ed25519.pub`) a `~/.ssh/authorized_keys` no
servidor. Depois disso o ssh não pede mais senha. Nunca mostre a chave
privada para ninguém!

Com `scp` e `rsync` você pode copiar arquivos via SSH, e no arquivo
`~/.ssh/config` você pode dar nomes curtos aos servidores – mas isso vai ter
que esperar um capítulo futuro.

## Quando a rede não funciona

"A internet não funciona" pode ter muitas causas. Siga os passos em ordem, de
dentro para fora – o primeiro passo que falhar mostra onde está o problema:

| Passo | Comando | Se falhar |
|---|---|---|
| 1. Eu tenho um endereço? | `ip a` | A placa está desligada (`state DOWN`) ou não recebeu endereço |
| 2. Existe um caminho para fora? | `ip route` | Sem linha `default` – sem gateway |
| 3. Consigo alcançar o roteador? | `ping -c 3 192.168.1.1` | Problema na rede local (cabo, Wi-Fi) |
| 4. Consigo alcançar a internet? | `ping -c 3 1.1.1.1` | Problema no roteador ou no provedor |
| 5. O DNS funciona? | `ping -c 3 example.com` | A consulta de nomes falha – confira `/etc/resolv.conf` |

O passo 4 pinga um endereço diretamente, sem nenhum nome. Se o passo 4
funciona mas o 5 não, quase sempre o culpado é o DNS – um dos problemas mais
comuns.

```quiz
`ping -c 3 1.1.1.1` funciona, mas `ping -c 3 example.com` responde
*Name or service not known*. Onde o problema está mais provavelmente?
- [ ] A placa de rede está desligada
- [ ] Não existe rota padrão
- [x] No DNS – a consulta de nomes não funciona
- [ ] O example.com não responde ao ping
---
Se você consegue alcançar um endereço na internet, a placa, a rota e o
roteador funcionam. O que sobra é traduzir o nome – confira o
`/etc/resolv.conf`.
```

Experimente você mesmo! Desligue a placa de rede, siga os passos e depois
ligue-a de novo:

```sh
sudo ip link set enp0s3 down
ip a
ip route
ping -c 3 192.168.1.1
ping -c 3 example.com
sudo ip link set enp0s3 up
```

## Os pacotes

As ferramentas de rede ficam em pacotes diferentes. No Ubuntu, eles se chamam:

| Ferramenta | Pacote no Ubuntu |
|---|---|
| `ip`, `ss` | `iproute2` |
| `ping` | `iputils-ping` |
| `dig`, `host`, `nslookup` | `dnsutils` |
| `traceroute` | `traceroute` |
| `ssh`, `ssh-keygen` | `openssh-client` |

Como sempre, outras famílias dão outros nomes a alguns dos pacotes – a parte
sobre distribuições e pacotes trata dessas diferenças.

O `traceroute` mostra cada roteador pelo qual os pacotes passam no caminho.
Instale-o e experimente `traceroute example.com`!

## Resumo

| Comando | Faz |
|---|---|
| `ip a` | Mostra os endereços IP |
| `ip route` | Mostra a tabela de roteamento e o gateway |
| `ping -c 3 HOST` | Testa se um computador pode ser alcançado |
| `dig +short NOME` | Consulta um nome no DNS |
| `getent hosts NOME` | Consulta como o sistema faz (com `/etc/hosts`) |
| `ss -tulpn` | Mostra as portas que estão escutando |
| `curl URL` | Busca e mostra |
| `curl -o ARQUIVO URL`, `wget URL` | Baixa para um arquivo |
| `ssh USUÁRIO@HOST COMANDO` | Roda um comando em outro computador |
