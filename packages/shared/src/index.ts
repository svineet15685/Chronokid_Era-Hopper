export interface ApiHealth {
  status: 'ok';
}

export interface ApiReadiness {
  status: 'ready' | 'not_ready';
}