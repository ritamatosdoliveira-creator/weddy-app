# Resumo executivo — Fase G (Memories e Documents)

**Resultado:** parcialmente concluída — falta apenas a suite completa a 41/41 (um teste de carga do formulário de contacto).

**Testes:** novos 94 (cliente) + 87 (regras reais) a passar. Suite: 40/41; as fases anteriores (B.1–F) preservadas e a passar.

**Correções (9):** ciclo de recarga em Memories; registo de documento sem ficheiro quando o envio falha; falhas de apagar no Storage agora registadas; foto em falta e `url` perigoso tratados; nomes de ficheiro seguros; duplo envio; abrir documento sem ficheiro; substituição de fotos existentes bloqueada na regra de Storage.

**Riscos:** regras validadas só em emulador; `storage.rules` alterado (publicar com cuidado — ver checklist); sem paginação em Memories; dois dispositivos reais e telemóvel real não testados.

**Pendências:** decidir sobre `contact-stress` (ver abaixo). Nenhuma outra.

**Próxima fase:** Fase H — Cake, Stationery e Vows Premium.

Nada foi enviado, fundido ou publicado.
