# Resumo: Scripts e automação

Nesta parte você transformou comandos em programas seus.

## Scripts de shell

Um script é um arquivo de texto com comandos que começa com o shebang
`#!/bin/bash`. Você pode escrevê-lo com um here document
(`cat > arquivo << '{{heredocEnd}}'`), torná-lo executável com `chmod +x` e executá-lo com
`./`. As linhas que começam com `#` são comentários.

Você cria variáveis com `nome=valor` – sem espaços – e as usa dentro de aspas
duplas: `"$nome"`, ou `"${nome}_texto"` quando vem texto logo depois. O
`$(comando)` é substituído pelo que o comando imprime, e o `$(( ))` faz
aritmética com inteiros. Um script lê os seus argumentos em `$1`, `$2` …,
`$#` e `"$@"`.

O `if` olha o código de saída de um comando, normalmente o comando de teste
`[ ]`. Números são comparados com `-eq`, `-lt` e companhia; texto com `=` e
`!=`. O `for` percorre uma lista, o `while` continua enquanto uma condição for
verdadeira, e o `while read` percorre um arquivo linha por linha. O `case`
escolhe entre padrões, funções são trechos de código com nome e com o seu
próprio `$1`, e o `read` pede uma entrada ao usuário. O `exit 1` avisa a quem
chamou o script que algo deu errado.

## Comandos e sintaxe

| Sintaxe | O que faz |
|---|---|
| `#!/bin/bash` | O shebang: qual programa executa o script |
| `cat > arquivo << '{{heredocEnd}}'` | Escreve linhas em um arquivo até a linha `{{heredocEnd}}` |
| `name=value` · `"$name"` · `"${name}"` | Cria · usa uma variável |
| `$(command)` | Substituído pelo que o comando imprime |
| `$(( a * 6 ))` · `(( a++ ))` | Aritmética com inteiros · altera uma variável |
| `$0` · `$1` · `$#` · `"$@"` | O nome do script · primeiro argumento · número de argumentos · todos os argumentos |
| `if [ ... ]; then ...; elif ...; else ...; fi` | Condições |
| `-f` · `-d` · `-z` | O arquivo existe · o diretório existe · a variável está vazia |
| `=` · `!=` | Texto igual · diferente |
| `-eq` · `-ne` · `-lt` · `-le` · `-gt` · `-ge` | Compara números |
| `[[ $file == *.txt ]]` | O teste mais esperto do bash, com padrões |
| `for x in list; do ...; done` | Percorre uma lista |
| `while [ ... ]; do ...; done` | Repete enquanto a condição for verdadeira |
| `while read line; do ...; done < file` | Percorre um arquivo linha por linha |
| `break` · `continue` | Sai do loop · vai para a próxima volta |
| `case $x in pattern) ...;; *) ...;; esac` | Escolhe por padrão |
| `name() { ...; }` · `local` · `return` | Uma função · variável local · encerra a função |
| `read -p "Question " var` | Lê uma linha do teclado |
| `exit 1` | Encerra o script com um código de saída |
| `set -euo pipefail` | Para o script no primeiro erro |
