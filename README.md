# Assinator2000

Sistema corporativo para leitura, aceite e assinatura eletrônica de documentos internos.

## Objetivo

O Assinator2000 tem como objetivo permitir que colaboradores da empresa:

- acessem o sistema utilizando autenticação corporativa;
- visualizem documentos pendentes de assinatura;
- realizem a leitura completa do documento;
- assinem eletronicamente utilizando tablet corporativo;
- tenham suas assinaturas registradas de forma auditável.

## Arquitetura planejada

O sistema será composto por:

- **Frontend:** HTML, CSS e JavaScript
- **Hospedagem:** GitHub Pages
- **Autenticação:** Microsoft Entra ID
- **Integração:** Microsoft Graph
- **Armazenamento:** Microsoft SharePoint
- **Dispositivo principal:** Tablet corporativo

## Fluxo do colaborador

1. Acessar o Assinator2000.
2. Realizar autenticação.
3. Visualizar documentos pendentes.
4. Abrir o documento.
5. Realizar a leitura completa.
6. Assinar eletronicamente.
7. Confirmar a assinatura.
8. Registrar o documento assinado no SharePoint.

## Estrutura inicial

```text
assinator2000/
│
├── index.html
├── README.md
│
├── assets/
│
├── css/
│   └── style.css
│
└── js/
    └── app.js