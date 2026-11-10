## Sistema para Gestão e Rastreabilidade de Rebanho Bovino de Corte

### Sobre o projeto 

O **SGRB** é um Sistema Web desenvolvido para auxiliar fazendas de pecuária de corte.

Sua finalidade é substituir controles manuais em cadernos e planilhas e garantir a rastreabilidade individual de cada animal, do nascimento ou da compra até a saída do rebanho.

O sistema utiliza um banco de dados relacional para possibilitar o cadastro, identificação, genealogia e pesagens dos animais, além de possibilitar os registros dos manejos sanitários, movimentação entre piquetes e documentos oficiais de trânsito (GTA). 

Com esses dados, o sistema apoia decisões que surgem no dia a dia das fazendas de pecuária de corte: quais animais estão aptos para venda, quais vacinas e reforços estão pendentes, quais piquetes estão lotados ou em descanso e quais animais têm melhor ganho de peso.

## Stack de Desenvolvimento 

As principais tecnologias escolhidas para desenvolver o sistema foram:

| Banco de Dados | Frontend | Backend
|--|--|--|
| PostgreSQL | React + Typescript + Vite| Node.js + Express + Typescript

## Banco de Dados

O SGRB utiliza o PostgreSQL como Sistema Gerenciador de Banco de Dados Relacional (SGBD), com hospedagem na plataforma [Neon](https://neon.com/).

A comunicação com o banco de dados é realizada pelo backend utilizando a biblioteca `pg` [[node-postgres](https://node-postgres.com/)] para estabelecer a conexão e executar os comandos SQL.

As credenciais de acesso são armazenadas em variáveis de ambiente, evitando sua exposição no código-fonte.

## Guia de Instalação

Para instalar o projeto corretamente, certifique-se de que os requisitos abaixo estão instalados:

## Pré-requisitos

 - node.js 22.x
 - npm 
 - git

### Windows
 Para instalar o Node.js 22.x com o npm no Windows faça o download: [node.js 22.23.4](https://nodejs.org/dist/latest-v22.x/node-v22.23.4-x64.msi)
 
-   Inicie o pacote `.msi` da instalação. 
    
-   Clique em Next.
    
-   Aceite os termos de licença.
    
-   Mantenha as opções padrão, inclua **o npm**.
    
-   Clique em Install.

### Linux
 Para instalar o Node.js com o npm no Linux: 

 1. `sudo apt update`
 2. `sudo apt install -y curl`
 3. `curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash`
 4. Feche e abra o terminal novamente.
 5. `nvm install 22`
 6. Defina como padrão: `nvm alias default 22` e `nvm use 22`

O npm já vem incluído na instalação do Node.js pelo NVM, então não é necessário instalá-lo separadamente.

##  Git Hub

Na sequência escolha uma pasta em seu computador e clone o repositório do projeto:

    git clone https://github.com/LayonFMartins/sgrb.git

## Instalação do Projeto

Para o banco de dados vamos usar a credencial de conexão da plataforma Neon.
<br>
 **Não compartilhe essa variável com IA, por e-mail e/ou similares. Nem inclua arquivos .env em commits.**

### Windows:

 Com o **Powershell** entre na pasta raiz onde o projeto foi clonado. 

 1. Execute: `npm.cmd ci`
 2. Copie o .env: `Copy-Item backend/.env.example backend/.env`
 3. Abra `backend/.env` no editor e preencha `DATABASE_URL` com a credencial de desenvolvimento autorizada do Banco de Dados hospedado na Neon.
 4. Configure também o `JWT_SECRET` conforme a seção [Configuração do JWT](#configuração-do-jwt).
 5. Em seguida `npm.cmd run dev:frontend` e `npm.cmd run dev:backend` em dois terminais **separados**.
 6. Teste `http://localhost:5173` e `http://localhost:3000/api/health/database`

### Linux:
Abra o terminal na pasta raiz do projeto. 

 1. Execute: `npm ci`
 2. Copie o .env: `cp backend/.env.example backend/.env`
 3. Abra `backend/.env` no editor e preencha `DATABASE_URL` com a credencial de desenvolvimento autorizada do Banco de Dados hospedado na Neon.
 4. Configure também o `JWT_SECRET` conforme a seção [Configuração do JWT](#configuração-do-jwt).
 5. Em seguida `npm run dev:frontend` e `npm run dev:backend` em dois terminais **separados**.
 6. Teste `http://localhost:5173` e `http://localhost:3000/api/health/database`

## Configuração do JWT

1. Gere uma chave aleatória de 32 bytes no terminal. No Linux, execute:

   ```bash
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

   No PowerShell do Windows:

   ```bash
   node.exe -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

2. No seu `backend/.env`, defina `JWT_SECRET` com o valor gerado:

   ```dotenv
   JWT_SECRET=
   ```

3. Em seguida `npm run dev:frontend` e `npm run dev:backend` em dois terminais **separados**.

## Dicas para o desenvolvimento com Git 

Foi criada uma branch develop, para buscá-la em seu repositório local execute: 

 ```bash
   git fetch origin
   git switch develop
   ```