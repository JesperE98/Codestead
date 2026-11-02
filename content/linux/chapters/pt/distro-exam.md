# Prova: Distribuições e pacotes

Responda às perguntas abaixo. Você precisa de 80 % para ser aprovado.

```quiz
Qual arquivo informa o nome e a versão da distribuição em todas as
distribuições modernas?
- [ ] `/etc/hostname`
- [x] `/etc/os-release`
- [ ] `/etc/version`
```

```try
uname -r
---
O `uname -r` mostra a versão do kernel Linux.
```

```quiz
Qual gerenciador de pacotes e qual formato de pacote andam juntos?
- [x] `pacman` e `.pkg.tar.zst`
- [ ] `dnf` e `.deb`
- [ ] `apt` e `.rpm`
```

```quiz
Qual distribuição é uma *rolling release*, sem versões?
- [ ] Ubuntu LTS
- [ ] Debian
- [x] Arch
- [ ] Fedora
```

```quiz
Qual é a diferença entre `apt update` e `apt upgrade`?
- [x] O `update` baixa a lista de pacotes disponíveis, o `upgrade` instala as versões novas
- [ ] O `update` instala as versões novas, o `upgrade` baixa a lista
- [ ] Não há diferença
```

```quiz
Qual comando instala o pacote `htop` no Arch?
- [ ] `sudo pacman -R htop`
- [ ] `sudo pacman -Q htop`
- [x] `sudo pacman -S htop`
- [ ] `sudo pacman -Ss htop`
```

```quiz
Por que é má ideia executar `pacman -Sy` e depois `pacman -S pacote`?
- [ ] Instala o pacote duas vezes
- [x] É uma atualização parcial, que pode quebrar o sistema
- [ ] O `-Sy` remove todos os pacotes instalados
```

```quiz
O dnf pergunta `Is this ok [y/N]` e você só pressiona Enter. O que acontece?
- [ ] O pacote é instalado
- [x] Nada é instalado – “não” é o padrão
```

```quiz
Quais destas afirmações sobre o AUR são verdadeiras?
- [x] Ele contém receitas de build (`PKGBUILD`), não pacotes prontos
- [x] Os pacotes dele não são revisados pelo Arch
- [ ] O `sudo pacman -Syu` atualiza os pacotes do AUR
- [ ] O `makepkg` deve ser executado com sudo
```

```quiz
Qual comando adiciona um repositório COPR no Fedora?
- [ ] `sudo add-apt-repository copr:user/project`
- [x] `sudo dnf copr enable user/project`
- [ ] `git clone` e `makepkg -si`
```

```quiz
Como os pacotes Snap são atualizados?
- [ ] Com `flatpak update`
- [x] Automaticamente, em segundo plano
- [ ] Baixando um arquivo novo do site do desenvolvedor
```

```predict
$ ~/{{downloads}}/{{calculator}}
bash: /home/{{user}}/{{downloads}}/{{calculator}}: Permission denied
---
Um arquivo baixado nunca começa sendo executável. Execute
`chmod +x ~/{{downloads}}/{{calculator}}` primeiro.
```

```quiz
Você quer uma versão mais nova de um programa de desktop que não está nos
repositórios da distribuição. O que a regra prática recomenda primeiro?
- [ ] Um repositório extra de alguém que você não conhece
- [x] Um Flatpak
- [ ] Compilar o programa a partir do código-fonte como root
```
