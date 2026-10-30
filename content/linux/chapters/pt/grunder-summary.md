# Resumo: O básico

Você aprendeu os comandos que vai usar todos os dias, em qualquer
distribuição. Aqui vai uma revisão rápida antes da prova.

## Navegando pelo sistema de arquivos

Tudo fica em uma única árvore que começa na raiz, `/`. As configurações ficam
em `/etc`, os programas em `/usr/bin`, os logs em `/var/log` e os seus
próprios arquivos no seu diretório pessoal, `~`. O `pwd` mostra onde você
está, o `ls` lista o que tem ali e o `cd` leva você para outro lugar. Um
caminho **absoluto** começa com `/`; um caminho **relativo** parte do
diretório em que você está. `..` é o diretório acima, e o `cd` sem argumentos
leva você para casa.

## Arquivos e diretórios

O `mkdir` cria diretórios (`-p` cria vários níveis de uma vez) e o `touch`
cria arquivos vazios. O `cp` copia (`-r` para diretórios inteiros), o `mv`
tanto move quanto renomeia, e o `rm` apaga – para sempre, não existe lixeira.
O `rmdir` só remove diretórios vazios; o `rm -r` remove um diretório e tudo o
que há dentro dele. Curingas como `*`, `?` e `[abc]` são expandidos pelo shell
antes de o comando ser executado, e nomes com espaços precisam de aspas.

## Lendo e pesquisando texto

O `cat` imprime um arquivo e o `less` permite percorrê-lo. O `head` e o
`tail` mostram o começo e o fim (`-n` escolhe quantas linhas, `tail -f`
acompanha um arquivo). O `wc` conta linhas, palavras e bytes. O `grep` mostra
as linhas que correspondem a um padrão, o `sort` ordena linhas e o `uniq`
remove linhas repetidas que estão uma ao lado da outra. O `man` mostra o
manual de um comando.

## Redirecionamento e pipes

Todo programa tem três fluxos: stdin, stdout e stderr. O `>` envia a stdout
para um arquivo (e o sobrescreve), o `>>` acrescenta, o `<` lê a stdin de um
arquivo e o `2>` redireciona as mensagens de erro – por exemplo, para
`/dev/null`. Um pipe `|` envia a saída de um comando para o próximo, e o `tee`
salva uma cópia no caminho. `;`, `&&` e `||` executam vários comandos em uma
linha.

## Processamento de texto com sed, tr e awk

O `tr` substitui, apaga (`-d`) ou comprime (`-s`) caracteres individuais e só
lê da stdin. O `sed` edita linhas: `s/velho/novo/` substitui (`g` para todas
as ocorrências), endereços escolhem linhas, `d` apaga e `-n` com `p` imprime
só o que você pedir. O `sed -i` altera o próprio arquivo. O `cut` recorta um
campo, e o `awk` trabalha com colunas: `-F` define o separador, `$1` … `$NF`
são os campos, um padrão antes das `{ }` escolhe linhas, e o `END { }` é
executado depois da última linha.

## Comandos e opções

| Comando | O que faz | Opções e sintaxe desta parte |
|---|---|---|
| `pwd` | Mostra o diretório em que você está | |
| `ls` | Lista o conteúdo de um diretório | `-l` formato longo, `-a` também arquivos ocultos |
| `cd` | Muda de diretório | `..` acima, `~` casa, `-` o último diretório, sem argumento = casa |
| `mkdir` | Cria um diretório | `-p` vários níveis de uma vez |
| `touch` | Cria um arquivo vazio | |
| `cp` | Copia | `-r` diretórios inteiros |
| `mv` | Move ou renomeia | |
| `rm` | Apaga | `-r` diretórios e o conteúdo deles, `-f` sem perguntas |
| `rmdir` | Remove um diretório vazio | |
| `cat` | Imprime um arquivo | |
| `less` | Mostra um arquivo página por página | `/palavra` pesquisa, `q` sai |
| `head` / `tail` | As primeiras / últimas linhas | `-n N` número de linhas, `tail -f` acompanha |
| `wc` | Conta linhas, palavras e bytes | `-l` só linhas |
| `grep` | Mostra as linhas que correspondem | `-i`, `-n`, `-v`, `-c`, `-r`, `-E` |
| `sort` | Ordena linhas | `-n` números, `-r` ordem inversa |
| `uniq` | Remove linhas repetidas vizinhas | `-c` conta as repetições |
| `man` | Mostra a página de manual | |
| `tee` | Passa a entrada adiante e salva uma cópia | |
| `tr` | Traduz caracteres | `-d` apaga, `-s` comprime |
| `sed` | Edita um fluxo de linhas | `s/…/…/g`, `d`, `p`, `q`, `-n`, `-i`, `-E`, `-e` |
| `cut` | Recorta campos | `-d` separador, `-f` campo |
| `awk` | Trabalha com colunas | `-F` separador, `$1`, `$NF`, `NF`, `NR`, `BEGIN`, `END` |

| Sintaxe | Significa |
|---|---|
| `>` / `>>` | stdout para um arquivo (sobrescreve / acrescenta) |
| `<` | stdin de um arquivo |
| `2>` | stderr para um arquivo, por exemplo `2> /dev/null` |
| `2>&1` | stderr pelo mesmo caminho que a stdout |
| `\|` | Pipe: a stdout de um comando para a stdin do próximo |
| `a ; b` | Executa a, depois b |
| `a && b` | Executa b só se a deu certo |
| `a \|\| b` | Executa b só se a falhou |
| `*`, `?`, `[abc]` | Curingas para nomes de arquivo |
