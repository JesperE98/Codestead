# Arquivos e diretórios

Agora que você já sabe se localizar, é hora de criar, copiar, mover e apagar
coisas.

## Criando diretórios – `mkdir`

```sh
mkdir imagens2
```

Se quiser criar vários níveis de uma vez, você precisa do `-p` (*parents*).
Sem ele, o `mkdir` reclama se o diretório pai não existir:

```sh
mkdir -p viagem/2026/junho
```

## Criando arquivos vazios – `touch`

O `touch` cria um arquivo vazio se ele não existir (e, caso contrário, apenas
atualiza a data e hora de modificação):

```sh
touch lista-de-compras.txt
```

```quiz
O que `touch {{notes}}` faz se o arquivo já existir?
- [ ] Esvazia o arquivo
- [ ] Reclama que o arquivo já existe
- [x] Apenas atualiza a data e hora do arquivo – o conteúdo continua o mesmo
```

## Copiando – `cp`

```sh
cp {{notes}} anotacoes-copia.txt
```

Se o destino for um diretório, a cópia vai parar dentro dele com o mesmo nome.
Para copiar um diretório inteiro, você precisa do `-r` (*recursive*):

```sh
cp -r {{documents}} {{documents}}-backup
```

```predict
$ mkdir copias
$ cp {{notes}} copias
$ ls copias
{{notes}}
---
`copias` é um diretório, então a cópia vai parar dentro dele com o mesmo nome.
```

## Movendo e renomeando – `mv`

No Linux, *mover* e *renomear* são a mesma coisa. O `mv` faz as duas:

```sh
mv lista-de-compras.txt {{documents}}/
mv {{documents}}/lista-de-compras.txt {{documents}}/compras.txt
```

```quiz
Não existe nenhum arquivo chamado `b.txt`. O que `mv a.txt b.txt` faz?
- [ ] Copia `a.txt` para `b.txt`
- [x] Renomeia `a.txt` para `b.txt`
- [ ] Falha, porque `b.txt` não existe
---
Mover e renomear são a mesma coisa. Depois disso, só existe `b.txt`.
```

## Apagando – `rm` e `rmdir`

```sh
rm anotacoes-copia.txt
```

O `rmdir` remove diretórios *vazios*. Para remover um diretório junto com tudo
o que há dentro dele, use `rm -r`:

```sh
rm -r {{documents}}-backup
```

> **Atenção!** Não existe lixeira no terminal. O que você apaga com `rm` some
> para sempre. O comando `rm -rf` (*recursive, force*) não pergunta nada e
> nunca reclama – sempre confira o caminho duas vezes antes de pressionar
> Enter.

```quiz
Qual comando remove o diretório `{{old}}` *apenas* se ele estiver vazio?
- [ ] `rm {{old}}`
- [x] `rmdir {{old}}`
- [ ] `rm -r {{old}}`
---
O `rmdir` se recusa a remover um diretório que ainda tenha algo dentro.
O `rm -r` remove o diretório e tudo o que há dentro dele.
```

## Curingas

O shell consegue expandir padrões em vários nomes de arquivo antes de o
comando ser executado:

| Padrão | Corresponde a |
|---|---|
| `*` | Qualquer coisa (zero ou mais caracteres) |
| `?` | Exatamente um caractere |
| `[abc]` | Um dos caracteres a, b ou c |

O diretório `{{documents}}` no seu diretório pessoal contém três arquivos:
`{{grades}}`, `{{fruits}}` e `server.log`. Isto lista apenas os que terminam
em `.txt`:

```sh
ls {{documents}}/*.txt
```

Aqui o `ls` nunca vê o asterisco – o shell já substituiu `{{documents}}/*.txt` por
todos os nomes de arquivo correspondentes.

```predict
$ ls {{documents}}/?????.*
{{documents}}/{{grades}}
---
Cada `?` é exatamente um caractere, então o nome antes do ponto precisa ter
cinco caracteres. Só `notas` tem – `frutas` e `server` são mais longos.
```

## Espaços em nomes de arquivo

O shell divide a linha de comando nos espaços. Se um arquivo tiver um espaço
no nome, você precisa usar aspas (ou uma `\` antes do espaço):

```sh
touch "meu arquivo.txt"
ls -l "meu arquivo.txt"
```

É por isso que muita gente prefere hifens ou sublinhados nos nomes de arquivo.
