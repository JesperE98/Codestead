# Arquivamento e compressão

Mais cedo ou mais tarde você vai querer mandar um diretório inteiro para
alguém, fazer um backup ou baixar o código-fonte de um programa. Aí muitos
arquivos precisam virar **um só** arquivo – de preferência menor. No Linux,
isso normalmente é feito por dois programas diferentes trabalhando juntos.

## Arquivar e comprimir – duas coisas diferentes

- **Arquivar** significa juntar muitos arquivos e diretórios em um único
  arquivo, um *arquivo-contêiner* (em inglês, *archive*). Permissões, donos e
  datas vão junto. O programa se chama `tar` (de *tape archive* – ele foi
  escrito para unidades de fita nos anos 1970). Um arquivo tar **não** é menor
  do que os arquivos dentro dele – se tanto, é maior.
- **Comprimir** significa deixar um arquivo menor codificando as repetições de
  um jeito mais esperto. O programa mais comum é o `gzip`. Ele só trata um
  arquivo por vez e não sabe nada sobre diretórios.

Por isso os dois são usados juntos: primeiro o `tar`, para obter um único
arquivo, depois o `gzip`, para deixá-lo menor. O resultado se chama
`.tar.gz`, ou `.tgz` para abreviar. É a filosofia Unix em poucas palavras –
programas pequenos que fazem uma coisa cada e podem ser combinados.

| Extensão | O que é? | Descompacte com |
|---|---|---|
| `.tar` | Arquivo tar, sem compressão | `tar -xf` |
| `.gz` | Um único arquivo comprimido | `gunzip` |
| `.tar.gz`, `.tgz` | Arquivo tar comprimido | `tar -xzf` |
| `.zip` | Arquivamento e compressão juntos (comum no Windows) | `unzip` |

Você também vai encontrar `.tar.xz`, `.tar.bz2` e `.tar.zst`. A ideia é a
mesma, mas com outros programas de compressão (`xz`, `bzip2` e `zstd`).

## Empacotando com o `tar`

Vá para o seu diretório pessoal e empacote o diretório `dokument`:

```sh
cd ~
tar -cvf dokument.tar dokument
```

```text
dokument/
dokument/frukter.txt
dokument/server.log
```

O `-c` significa *criar um arquivo tar*, o `-v` faz o tar mostrar o que está
fazendo e o `-f` diz que o nome do arquivo tar vem logo em seguida. Tudo o
que vier depois do nome do arquivo tar é empacotado – quantos arquivos e
diretórios você quiser.

> **Atenção!** A ordem é *primeiro o arquivo tar, depois os arquivos*. Se você
> trocar a ordem, como em `tar -cvf dokument dokument.tar`, o tar tenta
> sobrescrever o diretório – ou pior, um arquivo que você queria manter.

## As opções para guardar de cabeça

| Opção | Vem de | Significa |
|---|---|---|
| `c` | **c**reate | Cria um novo arquivo tar |
| `x` | e**x**tract | Descompacta |
| `t` | lis**t** (*table of contents*) | Lista o conteúdo |
| `v` | **v**erbose | Mostra os arquivos sendo processados |
| `f` | **f**ile | O nome do arquivo tar vem em seguida |
| `z` | g**z**ip | Comprime ou descomprime com o gzip |

Exatamente **uma** das opções `c`, `x` e `t` precisa estar presente – ela diz
ao tar *o que* fazer. As demais são modificadores. Um jeito comum de
memorizar (em inglês):

- **c**reate **z**ipped **v**erbose **f**ile → `tar -czvf`
- e**x**tract **z**ipped **v**erbose **f**ile → `tar -xzvf`
- lis**t** **z**ipped **v**erbose **f**ile → `tar -tzvf`

Sempre coloque o `f` **por último** quando escrever as opções juntas, já que o
nome do arquivo precisa vir logo depois dele. Por razões históricas, você
também pode omitir o hífen: `tar czvf` significa o mesmo que `tar -czvf`.

## Comprimindo com `-z`

Acrescente o `z` e o arquivo tar passa pelo gzip no caminho:

```sh
tar -czvf dokument.tar.gz dokument
ls -l dokument.tar dokument.tar.gz
```

```text
-rw-r--r-- 1 elev elev 10240 Oct 30 12:00 dokument.tar
-rw-r--r-- 1 elev elev   674 Oct 30 12:00 dokument.tar.gz
```

O arquivo tar sem compressão tem nada menos que 10.240 bytes, embora os
arquivos somem pouco menos de 900 bytes. Isso acontece porque o tar coloca um
cabeçalho de 512 bytes antes de cada arquivo e completa o arquivo tar até
fechar blocos inteiros. Todo esse espaço vazio é eliminado pelo gzip.

O comando `du` (*disk usage*) mostra quanto espaço algo ocupa no disco. Com
`-h` você obtém tamanhos legíveis para humanos e com `-s`, um total para um
diretório inteiro:

```sh
du -h dokument.tar dokument.tar.gz
du -sh dokument
```

```text
12K	dokument.tar
4.0K	dokument.tar.gz
12K	dokument
```

O disco é dividido em blocos de 4 KiB, então o `du` nunca mostra menos de
`4.0K` para um arquivo que não esteja vazio. Para ver o tamanho exato, use
`ls -l` (ou `ls -lh`).

## Olhe dentro do arquivo tar antes de descompactar

```sh
tar -tzvf dokument.tar.gz
```

```text
drwxr-xr-x elev/elev         0 2026-10-30 12:00 dokument/
-rw-r--r-- elev/elev        64 2026-10-30 12:00 dokument/frukter.txt
-rw-r--r-- elev/elev       848 2026-10-30 12:00 dokument/server.log
```

Com o `v`, o conteúdo aparece como no `ls -l`, com permissões, dono e
tamanho. Olhar antes é um bom hábito: alguns arquivos tar não têm um
diretório comum no topo e espalham centenas de arquivos onde quer que você
esteja quando os descompacta.

## Descompactando

```sh
mkdir uppackat
tar -xzvf dokument.tar.gz -C uppackat
```

O `-C` (C maiúsculo) escolhe o diretório onde o tar descompacta (*uppackat*
significa "descompactado"). Sem ele, tudo vai parar no diretório em que você
está. As versões modernas do tar detectam sozinhas, na hora de descompactar,
se um arquivo está comprimido, então `tar -xf dokument.tar.gz` também
funciona.

> **Atenção!** O tar não pergunta antes de sobrescrever arquivos que já
> existem. Liste o conteúdo antes se não tiver certeza.

### Caminhos absolutos

Se você empacotar um caminho absoluto, a `/` inicial é removida para que o
arquivo tar possa ser descompactado em qualquer lugar:

```sh
tar -czf backup.tar.gz ~/dokument
```

```text
tar: Removing leading `/' from member names
```

O arquivo tar agora contém `home/elev/dokument/...`. Se você quiser apenas
`dokument/` no arquivo tar, pode deixar o tar mudar de diretório antes com
`-C`:

```sh
tar -czf backup.tar.gz -C ~ dokument
tar -tzf backup.tar.gz
```

## Comprimindo arquivos individuais com o `gzip`

O `gzip` comprime um arquivo e o **substitui** por um arquivo `.gz`. As
permissões e a data são mantidas:

```sh
cp dokument/server.log .
gzip -v server.log
```

```text
server.log:	 39.0% -- replaced with server.log.gz
```

O `gzip -l` mostra o tamanho antes e depois, e o `gunzip` descompacta o
arquivo de novo:

```sh
gzip -l server.log.gz
gunzip server.log.gz
```

Se quiser manter o original, use `gzip -k` (*keep*). Experimente com um
arquivo bem pequeno – ele na verdade fica **maior**, porque o gzip acrescenta
um cabeçalho que contém, entre outras coisas, o nome do arquivo:

```sh
cp dokument/frukter.txt .
gzip -kv frukter.txt
```

```text
frukter.txt:	-20.3% -- created frukter.txt.gz
```

### Lendo arquivos comprimidos diretamente

Arquivos de log antigos em `/var/log` costumam ser guardados como `.gz` para
economizar espaço. Com o `zcat` você pode lê-los sem descompactar – e o
resultado pode seguir por um pipe como de costume:

```sh
gzip server.log
zcat server.log.gz | grep ERROR
```

O `zcat` é o mesmo que `gzip -dc`: descomprimir (`d`) para a saída padrão
(`c`). Em um sistema real também existem o `zless` e o `zgrep`.

## zip – para compartilhar com o Windows

O formato `.zip` faz as duas coisas de uma vez: junta os arquivos *e* os
comprime. O Windows e o macOS abrem arquivos zip sem nenhum programa extra,
então ele é a escolha óbvia quando você vai mandar arquivos para alguém que
não usa Linux. No mundo Linux, o `.tar.gz` é mais comum, já que preserva
melhor os donos e as permissões.

Os programas `zip` e `unzip` nem sempre vêm pré-instalados. Nesse caso, você
os instala com o gerenciador de pacotes – mais sobre isso no capítulo sobre
gerenciamento de pacotes. No {{distro}} é assim:

:::debian
```sh
sudo apt update
sudo apt install zip unzip
```

O `apt update` baixa a lista de pacotes disponíveis. Sem ele, o apt não
consegue encontrar pacote nenhum.
:::

:::arch
```sh
sudo pacman -S zip unzip
```

Responda sim (`Y` ou apenas Enter) quando o pacman perguntar se você quer
continuar.
:::

:::redhat
```sh
sudo dnf install zip unzip
```

Responda `y` quando o dnf perguntar `Is this ok [y/N]` – o `N` maiúsculo
significa que "não" é o padrão se você só pressionar Enter.
:::

Depois, empacote o diretório. Não esqueça o `-r` (*recursive*) – sem ele, o
zip só adiciona o diretório vazio, não os arquivos que estão dentro dele:

```sh
zip -r dokument.zip dokument
```

```text
  adding: dokument/ (stored 0%)
  adding: dokument/frukter.txt (deflated 27%)
  adding: dokument/server.log (deflated 42%)
```

Repare que a ordem é a mesma do tar: primeiro o arquivo zip, depois os
arquivos. O `unzip -l` lista o conteúdo, e o `-d` escolhe onde descompactar
(o diretório é criado se não existir):

```sh
unzip -l dokument.zip
unzip dokument.zip -d fran-zip
```

Se os arquivos já existirem, o unzip os pula. Com `unzip -o` eles são
sobrescritos.

## Resumo

| Se você quer ... | Comando |
|---|---|
| empacotar e comprimir um diretório | `tar -czvf arquivo.tar.gz diretório` |
| ver o que um arquivo tar contém | `tar -tzvf arquivo.tar.gz` |
| descompactar um arquivo tar | `tar -xzvf arquivo.tar.gz` (acrescente `-C diretório`) |
| comprimir um arquivo | `gzip arquivo` (ou `gzip -k arquivo`) |
| descompactar um arquivo `.gz` | `gunzip arquivo.gz` |
| ler um arquivo `.gz` diretamente | `zcat arquivo.gz` |
| criar ou descompactar um arquivo zip | `zip -r arquivo.zip diretório` · `unzip arquivo.zip` |
| ver o tamanho de algo | `du -sh diretório` · `ls -lh` |
