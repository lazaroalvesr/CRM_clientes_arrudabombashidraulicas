# Integração de empresas reais — pendente

O usuário confirmou que a fonte ainda precisa ser definida. A plataforma não simula busca na internet nem gera números de contato. A base operacional começa vazia.

## Contrato disponível

Defina `PROSPECT_API_URL` com endpoint HTTPS de um adaptador contratado/implementado e `PROSPECT_API_KEY` com sua chave. Essas variáveis ficam exclusivamente no servidor. Reinicie a aplicação; o botão **Buscar novas empresas** passa a estar disponível.

O sistema envia POST JSON com `state`, `city`, `segment` e `size` (campos não selecionados são strings vazias). Envia a chave como `Authorization: Bearer ...` se configurada. Há prazo máximo de 20 segundos, limite de resposta de 2 MB e 100 empresas por busca. Redirecionamentos HTTP são recusados para não encaminhar credenciais.

Resposta esperada:

```json
{
  "companies": [
    {
      "name": "NOME REAL VERIFICADO",
      "city": "CIDADE",
      "state": "SP",
      "segment": "Concreteira",
      "size": "Não informado",
      "cnpj": null,
      "phone": "",
      "whatsapp": "",
      "website": "",
      "sourceUrl": "https://fonte-publica-da-empresa.example",
      "structure": "",
      "pumping": null,
      "fleet": null,
      "branches": null
    }
  ]
}
```

O exemplo é apenas um contrato, não é um lead. O endpoint de nenhum fornecedor específico foi implementado ou validado.

- Segmentos: `Concreteira`, `Bombeamento de concreto`, `Construtora`, `Locadora`.
- Portes: `Pequeno`, `Médio`, `Grande`, `Não informado`.
- Sinais: `true`/`1` para sim; `false`/`0` para não; `null` para desconhecido.
- WhatsApp: apenas dígitos, com país 55 e DDD. Só preencher quando a fonte confirmar que é WhatsApp. Um telefone comum não deve ser promovido automaticamente a WhatsApp.
- `sourceUrl` é obrigatório. O adaptador deve garantir procedência, datas e adequação dos dados; o servidor valida formato e não acessa o site para conferir fatos.
- A data apresentada pela aplicação é a data do cadastro/importação, não a data da última alteração no site de origem.
- Registros inválidos são descartados com contagem informada ao usuário. Empresas existentes não são sobrescritas silenciosamente. A deduplicação usa CNPJ, quando disponível, ou nome normalizado + cidade + estado. Nomes comerciais diferentes sem CNPJ podem exigir revisão manual.

## Critérios para escolha

Escolher com a Arruda Bombas a cobertura por cidade e segmento, acesso a contatos comerciais, autorização de uso, limites de consulta, custo e atualização. CNPJ ou cadastro público por si só não comprova bombeamento, frota, porte operacional ou WhatsApp. Não inferir esses sinais sem evidência. Ajustar o adaptador à documentação oficial do fornecedor escolhido e verificar resultados reais antes de liberar para vendas.
