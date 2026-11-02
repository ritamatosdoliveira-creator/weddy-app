# Testes de robustez do estado (A.4)
Playwright (Python), sem rede: constrói uma cópia de `app/index.html` com um gancho de teste (`build4.py` → `/tmp/sx/app_a4.html`) e corre
- `t4.py`: matriz de corrupção (27 chaves de topo × 8 valores errados), render sem sanitizar (isolamento), casos concretos, `__proto__`, raiz inválida, backup local, desempenho e o caminho do snapshot (telemóvel + desktop);
- `t4b.py`: o mesmo em profundidade 2 (37 caminhos × 8 valores = 296 casos).
Os caminhos `/tmp/sx` são os do ambiente de testes; ajustar ao reutilizar (`firebase` é simulado por um Proxy, o ecrã de login é escondido por CSS).
