-- OperaLog — Schema do Banco de Dados
-- Execute no PostgreSQL do Railway

-- Extensão para UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── USUÁRIOS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  senha VARCHAR(255) NOT NULL,
  perfil VARCHAR(20) NOT NULL DEFAULT 'analista',
  -- perfil: 'admin' | 'gestor' | 'analista' | 'diretoria'
  idioma VARCHAR(5) NOT NULL DEFAULT 'pt-BR',
  -- idioma: 'pt-BR' | 'pt-PT' | 'es'
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMP DEFAULT NOW(),
  ultimo_acesso TIMESTAMP
);

-- ─── OPERAÇÕES IN HOUSE ───────────────────────────────
CREATE TABLE IF NOT EXISTS operacoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cliente VARCHAR(150) NOT NULL,
  local VARCHAR(150) NOT NULL,
  pais VARCHAR(5) NOT NULL DEFAULT 'BR',
  -- pais: 'BR' | 'AR' | 'PT'
  equipe_qtd INTEGER DEFAULT 0,
  servicos TEXT[],
  status VARCHAR(20) DEFAULT 'ativo',
  -- status: 'ativo' | 'alerta' | 'critico' | 'encerrado'
  notas TEXT,
  criado_em TIMESTAMP DEFAULT NOW(),
  atualizado_em TIMESTAMP DEFAULT NOW()
);

-- ─── TRANSPORTADORAS ──────────────────────────────────
CREATE TABLE IF NOT EXISTS transportadoras (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome VARCHAR(150) NOT NULL,
  sigla VARCHAR(10),
  regiao VARCHAR(150),
  pais VARCHAR(5) NOT NULL DEFAULT 'BR',
  contato VARCHAR(150),
  email VARCHAR(150),
  score DECIMAL(3,1) DEFAULT 0,
  ativa BOOLEAN DEFAULT true,
  criado_em TIMESTAMP DEFAULT NOW()
);

-- ─── KPIs DAS TRANSPORTADORAS (PET) ──────────────────
CREATE TABLE IF NOT EXISTS pet_registros (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transportadora_id UUID REFERENCES transportadoras(id) ON DELETE CASCADE,
  periodo_inicio DATE NOT NULL,
  periodo_fim DATE NOT NULL,
  otd DECIMAL(5,2),              -- % entregas no prazo
  atraso_medio DECIMAL(5,2),     -- horas
  ocorrencias_mil DECIMAL(5,2),  -- por 1000 viagens
  satisfacao DECIMAL(3,1),       -- 0 a 10
  score_calculado DECIMAL(3,1),  -- calculado automaticamente
  total_viagens INTEGER DEFAULT 0,
  notas TEXT,
  registrado_por UUID REFERENCES usuarios(id),
  criado_em TIMESTAMP DEFAULT NOW()
);

-- ─── OCORRÊNCIAS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS ocorrencias (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  titulo VARCHAR(200) NOT NULL,
  descricao TEXT,
  severidade VARCHAR(20) NOT NULL DEFAULT 'informativo',
  -- severidade: 'critico' | 'alerta' | 'informativo' | 'positivo'
  status VARCHAR(20) DEFAULT 'aberta',
  -- status: 'aberta' | 'em_andamento' | 'resolvida'
  operacao_id UUID REFERENCES operacoes(id) ON DELETE SET NULL,
  transportadora_id UUID REFERENCES transportadoras(id) ON DELETE SET NULL,
  resolucao TEXT,
  registrado_por UUID REFERENCES usuarios(id),
  resolvido_por UUID REFERENCES usuarios(id),
  criado_em TIMESTAMP DEFAULT NOW(),
  resolvido_em TIMESTAMP
);

-- ─── PLANOS PDCA ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS pdca_planos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  titulo VARCHAR(200) NOT NULL,
  descricao TEXT,
  etapa VARCHAR(10) NOT NULL DEFAULT 'plan',
  -- etapa: 'plan' | 'do' | 'check' | 'act' | 'concluido'
  responsavel VARCHAR(100),
  prazo DATE,
  operacao_id UUID REFERENCES operacoes(id) ON DELETE SET NULL,
  transportadora_id UUID REFERENCES transportadoras(id) ON DELETE SET NULL,
  meta TEXT,
  resultado TEXT,
  criado_por UUID REFERENCES usuarios(id),
  criado_em TIMESTAMP DEFAULT NOW(),
  atualizado_em TIMESTAMP DEFAULT NOW()
);

-- ─── HISTÓRICO PDCA ───────────────────────────────────
CREATE TABLE IF NOT EXISTS pdca_historico (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plano_id UUID REFERENCES pdca_planos(id) ON DELETE CASCADE,
  etapa_anterior VARCHAR(10),
  etapa_nova VARCHAR(10),
  comentario TEXT,
  alterado_por UUID REFERENCES usuarios(id),
  criado_em TIMESTAMP DEFAULT NOW()
);

-- ─── KPIs OPERACIONAIS ────────────────────────────────
CREATE TABLE IF NOT EXISTS kpi_registros (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  operacao_id UUID REFERENCES operacoes(id) ON DELETE CASCADE,
  data_referencia DATE NOT NULL,
  acuracidade_inventario DECIMAL(5,2),  -- %
  taxa_erro_picking DECIMAL(5,3),       -- %
  produtividade_hora DECIMAL(8,2),      -- unidades/hora
  lead_time_expedicao DECIMAL(5,2),     -- horas
  notas TEXT,
  registrado_por UUID REFERENCES usuarios(id),
  criado_em TIMESTAMP DEFAULT NOW()
);

-- ─── ÍNDICES PARA PERFORMANCE ─────────────────────────
CREATE INDEX IF NOT EXISTS idx_ocorrencias_status ON ocorrencias(status);
CREATE INDEX IF NOT EXISTS idx_ocorrencias_severidade ON ocorrencias(severidade);
CREATE INDEX IF NOT EXISTS idx_ocorrencias_criado ON ocorrencias(criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_pdca_etapa ON pdca_planos(etapa);
CREATE INDEX IF NOT EXISTS idx_pet_transportadora ON pet_registros(transportadora_id);
CREATE INDEX IF NOT EXISTS idx_kpi_operacao ON kpi_registros(operacao_id);
CREATE INDEX IF NOT EXISTS idx_kpi_data ON kpi_registros(data_referencia DESC);

-- ─── DADOS INICIAIS ───────────────────────────────────

-- Usuário admin padrão (senha: operalog2025)
-- Hash gerado com bcrypt rounds=10
INSERT INTO usuarios (nome, email, senha, perfil, idioma) VALUES
('Administrador', 'admin@operalog.app', '$2a$10$rQJ8vGz8sF4nL2mK7pXx8OQqKvF5nN3mL8pR1tY6wJ4xK2vB9cD7e', 'admin', 'pt-BR')
ON CONFLICT (email) DO NOTHING;

-- ─── FUNÇÃO PARA ATUALIZAR SCORE AUTOMATICAMENTE ─────
CREATE OR REPLACE FUNCTION calcular_score_pet(
  p_otd DECIMAL,
  p_atraso_medio DECIMAL,
  p_ocorrencias_mil DECIMAL,
  p_satisfacao DECIMAL
) RETURNS DECIMAL AS $$
DECLARE
  score_otd DECIMAL;
  score_atraso DECIMAL;
  score_ocorrencias DECIMAL;
  score_satisfacao DECIMAL;
BEGIN
  -- OTD: meta >= 95%, peso 40%
  score_otd := LEAST(10, (p_otd / 95.0) * 10) * 0.4;

  -- Atraso médio: meta <= 2h, peso 30%
  IF p_atraso_medio <= 2 THEN
    score_atraso := 10 * 0.3;
  ELSIF p_atraso_medio <= 4 THEN
    score_atraso := (1 - ((p_atraso_medio - 2) / 8)) * 10 * 0.3;
  ELSE
    score_atraso := 0;
  END IF;

  -- Ocorrências: meta <= 5/1000, peso 20%
  IF p_ocorrencias_mil <= 5 THEN
    score_ocorrencias := 10 * 0.2;
  ELSE
    score_ocorrencias := GREATEST(0, (1 - ((p_ocorrencias_mil - 5) / 15)) * 10) * 0.2;
  END IF;

  -- Satisfação: peso 10%
  score_satisfacao := (p_satisfacao / 10.0) * 10 * 0.1;

  RETURN ROUND(score_otd + score_atraso + score_ocorrencias + score_satisfacao, 1);
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar score automaticamente
CREATE OR REPLACE FUNCTION trigger_atualizar_score()
RETURNS TRIGGER AS $$
BEGIN
  NEW.score_calculado := calcular_score_pet(
    NEW.otd,
    NEW.atraso_medio,
    NEW.ocorrencias_mil,
    NEW.satisfacao
  );

  -- Atualiza score médio na transportadora
  UPDATE transportadoras
  SET score = (
    SELECT ROUND(AVG(score_calculado), 1)
    FROM pet_registros
    WHERE transportadora_id = NEW.transportadora_id
    AND criado_em >= NOW() - INTERVAL '90 days'
  )
  WHERE id = NEW.transportadora_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_score_pet
BEFORE INSERT OR UPDATE ON pet_registros
FOR EACH ROW EXECUTE FUNCTION trigger_atualizar_score();

-- Trigger para atualizar timestamp
CREATE OR REPLACE FUNCTION trigger_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_operacoes_updated
BEFORE UPDATE ON operacoes
FOR EACH ROW EXECUTE FUNCTION trigger_updated_at();

CREATE TRIGGER trg_pdca_updated
BEFORE UPDATE ON pdca_planos
FOR EACH ROW EXECUTE FUNCTION trigger_updated_at();
