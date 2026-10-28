/** Textos em português (Angola). Outras línguas seguem a mesma forma. */
export const pt = {
  tagline: 'Profissionais verificados, perto de ti.',
  intro:
    'Pintores, canalizadores, babás, explicadores, motoristas e muito mais, em Luanda. Com pagamento protegido.',
  auth: {
    google: 'Continuar com Google',
    apple: 'Continuar com Apple',
    facebook: 'Continuar com Facebook',
    phone: 'Entrar com número de telefone',
    phoneLabel: 'Número de telemóvel',
    phonePlaceholder: '923 456 789',
    phoneInvalid: 'Introduz um número de telemóvel angolano válido (9 dígitos, começa por 9).',
    sendCode: 'Enviar código',
    codeLabel: 'Código recebido por SMS',
    verify: 'Confirmar',
    codeSent: 'Enviámos um código por SMS para',
    back: 'Voltar',
    isProfessional: 'É profissional?',
    createPro: 'Criar conta de profissional',
    legal:
      'Ao continuar aceitas os Termos e a Política de Privacidade. Os teus dados são tratados nos termos da Lei n.º 22/11 de Protecção de Dados Pessoais.',
    signOut: 'Sair',
    error: 'Não foi possível entrar. Tenta novamente.',
  },
  home: {
    hello: 'Olá',
    whoDoYouNeed: 'Quem precisas hoje?',
    searchPlaceholder: 'Descreve o que precisas…',
    categories: 'Categorias',
    becomePro: 'És profissional?',
    becomeProText:
      'Faz o cadastro verificado e recebe pedidos de clientes perto de ti, com pagamento garantido.',
    becomeProCta: 'Quero ser Biska+',
  },
} as const;

export type Messages = typeof pt;
