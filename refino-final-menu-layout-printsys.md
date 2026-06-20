# Refino Final do Menu e Layout do PrintSys

## Status

**MENU DESBLOQUEADO E INTERFACE PADRONIZADA**

## Causa real do menu bloqueado

A permissao do Admin estava correta, mas a rotina visual `prepareButtonFallbacks()` desabilitava qualquer botao sem uma acao direta identificada.

Os botoes que abrem os grupos do menu lateral nao possuem rota direta, pois servem para abrir e fechar submenus. Por isso, eram classificados indevidamente como botoes sem funcao e recebiam estado desabilitado/cinza.

## Correcao aplicada

- Botoes dentro do menu lateral foram excluidos da rotina de desabilitacao generica.
- Itens permitidos agora sao reabilitados explicitamente ao renderizar permissoes.
- Estado `inactive-action`, `disabled` e `aria-disabled` e removido dos menus permitidos.
- Admin Geral continua com acesso total.
- Gestor comum deixou de ser tratado automaticamente como Admin.
- O menu continua sendo reconstruido depois de login, troca de loja e recarregamento.

## Novo padrao visual do menu

- Fundo roxo profissional.
- Texto e icones brancos.
- Item ativo branco com texto roxo.
- Nenhum item permitido usa opacidade que pareca bloqueio.
- Menus principais e submenus usam a mesma altura: `42px`.
- Menus principais e submenus usam o mesmo tamanho de fonte: `14px`.
- Diferenciacao de hierarquia feita por recuo e peso, nao por tamanho desproporcional.
- Icones com tamanho fixo e alinhamento consistente.
- Espacamento lateral e vertical uniforme.

## Padronizacao tipografica

- Titulo principal: `26px`.
- Titulos de secao: `18px`.
- Subtitulos: `14px`.
- Texto normal: `14px`.
- Menu e submenu: `14px`.
- Botoes: `14px`.
- Labels: `13px`.
- Textos auxiliares: `12px`.
- Numeros e destaques foram limitados para evitar elementos desproporcionais.

## Ortografia e apresentacao

- Nomes principais do menu foram corrigidos com acentuacao.
- Foi adicionada correcao de apresentacao para textos antigos com codificacao quebrada.
- Termos recorrentes como Orcamento, Producao, Gestao, Configuracoes, Preco e Historico passam a ser exibidos corretamente.
- A correcao atua apenas na apresentacao visual e nao altera dados persistidos.

## Seletor de empresa

- Reduzido para um controle compacto no header.
- Passa a mostrar `Loja: Todas` ou o nome curto da loja.
- Admin continua podendo trocar de loja.
- Usuario comum continua restrito as lojas permitidas.
- O seletor nao compete visualmente com busca, status e acoes.

## Orcamento

- Resumo lateral reduzido para `280px`.
- Valor final e saldo permanecem prioritarios.
- Margem e lucro ficaram compactos e discretos.
- Margem, lucro e memoria de calculo ficam ocultos para usuario sem perfil administrativo.
- Cards de itens passam a ser a visualizacao principal.
- A tabela redundante de itens e ocultada quando os cards organizados estao disponiveis.
- O motor de precificacao nao foi alterado.

## Ordem de Servico

- Conteudo principal e resumo lateral possuem proporcao mais equilibrada.
- Acoes usam tamanho e alinhamento padronizados.
- Valores destacados foram reduzidos para nao dominar a tela.
- Regras e fluxo homologado foram preservados.

## Producao

- Indicadores ficaram menores e uniformes.
- Filtros usam espacamento consistente.
- Acoes por O.S. permanecem visiveis e alinhadas.
- Nenhum fluxo produtivo foi alterado.

## Componentes padronizados

- Cards: raio de `14px`.
- Cards internos: raio de `10px`.
- Inputs: altura minima de `44px`.
- Botoes: altura minima de `40px`.
- Abas: altura de `42px`.
- Tabelas, badges, paineis laterais e estados vazios usam tipografia consistente.

## Testes executados

- `npm.cmd run check`: aprovado.
- `node --check server.js`: aprovado.
- `node --check public/app.js`: aprovado.
- Servidor em `http://localhost:3000`: HTTP `200`.
- Admin Geral em `Todas as lojas`: zero permissoes bloqueadas.
- Admin Geral na Loja Principal: zero permissoes bloqueadas.
- Admin Geral em outra loja: zero permissoes bloqueadas.
- Dashboard, orcamentos, O.S., PCP, financeiro, estoque e custos: APIs HTTP `200`.
- Retorno do Admin para `Todas as lojas`: aprovado.

## Validacao visual automatizada

A conexao automatizada com o navegador interno nao iniciou por uma limitacao do ambiente Windows. A validacao de sintaxe, servidor, arquivos servidos, permissoes, troca de loja e APIs foi concluida.

## Arquivos alterados

- `public/app.js`
- `public/styles.css`

## Pendencia real

- Fazer uma conferencia visual humana apos recarregar a pagina ignorando o cache, especialmente em resolucoes muito pequenas.
