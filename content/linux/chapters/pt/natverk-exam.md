# Prova: Redes

Mostre o que você aprendeu sobre endereços, nomes, portas, a web e o SSH.
As perguntas cobrem a parte inteira, e você precisa de 80 % de acertos para
ser aprovado.

```quiz
Quais destes endereços são **privados** – usados só dentro de redes locais?
(Escolha todas as que se aplicam.)
- [x] `10.0.0.5`
- [x] `172.20.1.1`
- [x] `192.168.0.7`
- [ ] `8.8.8.8`
- [ ] `1.1.1.1`
```

```quiz
Um servidor web que você está desenvolvendo roda no seu próprio computador.
Para onde vai o tráfego quando você o testa em `http://localhost:8080`?
- [ ] Sai até o roteador e volta
- [x] Para lugar nenhum – o tráfego para o localhost nunca sai do computador
- [ ] Para o servidor DNS, que o envia de volta
- [ ] Para `192.168.1.1`
```

```try
ip route
---
A linha `default` mostra o gateway para o qual todo o resto é enviado.
```

A linha do `localhost` no `/etc/hosts` é o que o sistema encontra. O que isto
imprime?

```predict
$ getent hosts localhost
127.0.0.1 localhost
```

Qual servidor DNS o Ubuntu consulta, segundo o `/etc/resolv.conf`?

```predict
$ grep nameserver /etc/resolv.conf
nameserver 127.0.0.53
---
`127.0.0.53` é o systemd-resolved, um intermediário local no seu próprio
computador que, por sua vez, pergunta ao roteador.
```

```quiz
Você executa `ping 192.168.1.1` sem nenhuma opção. Quando ele para?
- [ ] Depois de 3 pacotes
- [ ] Depois de um pacote
- [x] Quando você pressiona Ctrl+C
- [ ] Quando chega a primeira resposta
---
Com `-c` você escolhe quantos pacotes enviar.
```

A ordem em que o sistema consulta os nomes é definida no
`/etc/nsswitch.conf`. O que isto imprime?

```predict
$ grep hosts: /etc/nsswitch.conf
hosts: files dns
---
Primeiro o arquivo (`/etc/hosts`), depois o DNS.
```

```quiz
Você adicionou `server.lan` ao `/etc/hosts`. O `ping server.lan` funciona,
mas o `dig +short server.lan` não imprime nada. Por quê?
- [ ] A linha no `/etc/hosts` está errada
- [x] O `dig` pergunta diretamente ao DNS e ignora o `/etc/hosts`
- [ ] O `dig` precisa de `sudo`
- [ ] O `ping` não usa nomes
---
Para ver o que o *sistema* resolve, use `getent hosts server.lan`.
```

```quiz
O `minserver` escuta na porta 8080 e roda como um usuário comum. O que seria
diferente se ele escutasse na porta 80?
- [ ] Nada
- [x] Só o root pode abrir portas abaixo de 1024
- [ ] A porta 80 é só para SSH
- [ ] A porta 80 não pode ser usada no localhost
```

```quiz
O `curl -I http://linux.org` responde `301 Moved Permanently`. Como você
obtém a página de verdade?
- [ ] `curl -s http://linux.org`
- [x] `curl -L http://linux.org` – seguir o redirecionamento
- [ ] `curl -o http://linux.org`
- [ ] Não dá – 301 significa que a página sumiu
```

```quiz
Você se conecta ao `server.lan` com ssh, e o ssh avisa em alto e bom som
que a chave do host do servidor mudou. O que isso pode significar?
- [ ] A sua senha expirou
- [x] Alguém pode estar se passando pelo servidor
- [ ] O servidor tem um usuário novo
- [ ] O seu par de chaves está quebrado
---
A chave do host foi salva em `~/.ssh/known_hosts` na primeira vez que você
se conectou.
```

```quiz
Você quer fazer login no servidor com um par de chaves em vez de uma senha.
Qual chave é colocada no servidor?
- [x] A chave pública, `id_ed25519.pub`
- [ ] A chave privada, `id_ed25519`
- [ ] As duas
- [ ] Nenhuma – o servidor cria a sua própria
---
O `ssh-copy-id` adiciona a chave pública a `~/.ssh/authorized_keys` no
servidor. Nunca mostre a chave privada a ninguém!
```

```quiz
O `ip a` mostra um endereço, e você consegue pingar outros computadores em
`192.168.1.0/24`, mas nada lá fora na internet. O `ip route` não tem linha
`default`. O que está errado?
- [ ] O DNS
- [x] Não há gateway – nada sabe para onde enviar o tráfego para fora da rede local
- [ ] A placa de rede está desligada
- [ ] O `/etc/hosts` está faltando
```
