# Prova: Scripts e automação

Responda às perguntas sobre scripts de shell – você precisa de 80 % para ser aprovado.

```quiz
O que a primeira linha `#!/bin/bash` de um script faz?
- [ ] É um comentário que o shell pula
- [x] Diz ao sistema qual programa deve executar o arquivo
- [ ] Torna o arquivo executável
---
Ela se chama *shebang*. Você continua precisando do `chmod +x` para tornar o
arquivo executável.
```

```quiz
`nome = Kim` dá o erro `command not found`. Por quê?
- [x] Os espaços em volta do `=` fazem o shell tratar `nome` como um comando
- [ ] Nomes de variáveis precisam ser escritos em letras maiúsculas
- [ ] Você precisa escrever `$nome = Kim`
```

```predict
$ qtd=$(ls ~/{{documents}} | wc -l)
$ echo "$qtd arquivos"
3 arquivos
```

```predict
$ a=5
$ (( a += 10 ))
$ echo $a
15
```

```quiz
O que o `"$@"` contém em um script?
- [ ] O número de argumentos
- [ ] O nome do script
- [x] Todos os argumentos, cada um separadamente
```

```quiz
Qual teste é verdadeiro quando o número em `n` é maior que 10?
- [ ] `[ $n > 10 ]`
- [x] `[ $n -gt 10 ]`
- [ ] `[ $n = 10 ]`
---
Números são comparados com `-eq`, `-lt`, `-gt` e assim por diante; `=` e `<`
comparam texto.
```

```predict
$ [ -d ~/{{missing}} ] && echo sim || echo não
não
```

```predict
$ arq=relatorio.txt
$ case $arq in *.jpg|*.png) echo "Uma imagem";; *.txt) echo "Um arquivo de texto";; *) echo "Tipo desconhecido";; esac
Um arquivo de texto
```

```predict
$ somar() { echo $(( $1 + $2 )); }
$ somar 4 5
9
```

```predict
$ for i in 1 2 3 4 5; do if [ $i -eq 3 ]; then continue; fi; echo $i; done
1
2
4
5
---
O `continue` pula direto para a próxima volta, então o `3` nunca é impresso.
```

```quiz
O que o `local` faz em uma função?
- [x] Cria uma variável que só existe dentro da função
- [ ] Faz a função rodar mais rápido
- [ ] Encerra a função com um código de saída
```

```quiz
Por que um script termina com `exit 1` quando algo dá errado?
- [ ] Para reiniciar o script
- [x] Para que quem chamou o script veja pelo código de saída que ele falhou
- [ ] Para imprimir o número 1
```

```quiz
Você começa um here document com `cat > {{helloScript}} << '{{heredocEnd}}'`. Quando ele termina?
- [ ] Quando você pressiona Enter em uma linha vazia
- [x] Na linha `{{heredocEnd}}`
- [ ] Depois de dez linhas
```

```try
for i in $(seq 1 3); do echo "Rodada $i"; done
```
