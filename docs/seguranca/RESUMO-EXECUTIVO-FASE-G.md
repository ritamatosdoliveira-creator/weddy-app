# Resumo executivo — Fase G (Memories e Documents)

**Resultado:** **concluída (local)**. Suite completa 41/41.

**Testes:** novos 94 (cliente) + 87 (regras reais) a passar. Suite completa: 41/41; as fases anteriores (B.1–F) preservadas. `contact-stress` 22/22 isolado.

**Correções (9):** ciclo de recarga em Memories; registo de documento sem ficheiro quando o envio falha; falhas de apagar no Storage agora registadas; foto em falta e `url` perigoso tratados; nomes de ficheiro seguros; duplo envio; abrir documento sem ficheiro; substituição de fotos existentes bloqueada na regra de Storage.

**Riscos:** regras validadas só em emulador; `storage.rules` alterado (publicar com cuidado — ver checklist); sem paginação em Memories; dois dispositivos reais e telemóvel real não testados.

**`contact-stress`:** o cenário de 40/60 pedidos simultâneos exigia «exatamente 8»; sob contenção o limitador recusa alguns (lado seguro, por desenho). O teste passou a aceitar 1–8 nesses dois cenários, com piso, coerência de emails e limite estrito; produção não foi alterada (detalhe no relatório).

**Pendências:** nenhuma desta fase. Validação manual em dispositivos reais e publicação ficam para depois.

**Próxima fase:** Fase H — Cake, Stationery e Vows Premium.

Nada foi enviado, fundido ou publicado.
