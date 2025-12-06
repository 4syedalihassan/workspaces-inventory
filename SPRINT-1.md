# Sprint 1: Infrastructure & Skeleton

## Goal
Establish a working technical foundation for a three-tier AWS Lightsail deployment, with Docker Compose running on all tiers and a unified codebase structure. The outcome: all tiers are operational with 'hello world' containers, CI/CD baseline, firewall rules, DNS/SSL, and API contract stubs. 

---

## Epics, User Stories & Task List

### Epic 1: Provisioning Infrastructure
**User Story 1.1:**
_As a devops engineer, I want to provision three AWS Lightsail instances (Web, Backend, AI Model) so I can deploy and test application tiers independently._
- [ ] Research and select optimal instance sizes for each tier (Web: 2 vCPU/8GB, Backend: 4 vCPU/16GB, AI: 4 vCPU/16GB suggested)
- [ ] Provision all three Lightsail instances in the same region
- [ ] Assign and record static IPs
- [ ] Document instance details

---

### Epic 2: Networking & Security Baseline
**User Story 2.1:**
_As an infrastructure engineer, I want to set up basic firewalls so only required traffic is permitted to each tier._
- [ ] Configure inbound/outbound rules as per design:
  - Web: 80, 443 (public); 22 (admin IP)
  - Backend: 8000 (Web IP); 22 (admin IP)
  - AI: 11434 (Backend IP); 22 (admin IP)
- [ ] Test port access using `curl` or `nmap`
- [ ] Document all rules

---

### Epic 3: Repo Structure Initialization
**User Story 3.1:**
_As a developer, I want a unified monorepo skeleton so teams can build/test independently._
- [ ] Create `/frontend`, `/backend`, `/ai_service` in repo
- [ ] Add README.md with architecture diagram and sprint summary
- [ ] Add relevant `.gitignore` files and a draft `CONTRIBUTING.md`

---

### Epic 4: Docker Compose Baselines
**User Story 4.1:**
_As a developer, I want to run a basic “hello world” container stack on each tier so I can validate connectivity and Docker setup._
- [ ] Web: `docker-compose.web.yml` with nginx serving static "hello world"
- [ ] Backend: `docker-compose.backend.yml` with FastAPI + placeholder Postgres & Redis
- [ ] AI: `docker-compose.phi.yml` with llama.cpp HTTP server (or placeholder)
- [ ] Ensure all containers healthy, services reachable

---

### Epic 5: DNS & SSL Routing (Staging)
**User Story 5.1:**
_As a user, I want to access the web UI via a custom domain with HTTPS._
- [ ] Set up (sub)domains in Route 53 or chosen DNS host
- [ ] Point A-record(s) to web server static IP
- [ ] Temporary self-signed or Let's Encrypt SSL cert on Nginx
- [ ] Ensure / loads static page, /api proxies backend (even if stubbed)

---

### Epic 6: CI/CD Skeleton
**User Story 6.1:**
_As a developer, I want automated build/test pipelines setup._
- [ ] Add sample GitHub Actions pipeline for build/test/lint
- [ ] CI triggers on PR/main; badge in README
- [ ] Document local lint/test commands

---

### Epic 7: Initial API Contract Draft
**User Story 7.1:**
_As a developer, I want a draft OpenAPI contract stubbed._
- [ ] Draft openapi.yaml or FastAPI skeleton for:
    - /auth/login
    - /workspaces
    - /ai/query
    - /reports
    - /admin/config
- [ ] Stub endpoints return 200/status JSON
- [ ] Link contract in README

---

## Acceptance Criteria (Definition of Done)
- [ ] All three instances up, networked, secured, reachable
- [ ] Monorepo is initialized and structured
- [ ] Docker Compose "hello world" on each tier works and is reachable per network rules
- [ ] DNS/SSL loads web page/API
- [ ] CI/CD runs on PR/push
- [ ] API contract documented and stubbed

---

## Notes
- Document all commands, instance details, and current state in README.md for team visibility.
- Once complete, review and demo to team before Sprint 2 planning.
