import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Simples controle de acesso: 
  // Se o motoboy tentar acessar /restaurant, podemos redirecionar ou apenas deixar 
  // para o controle visual. O usuário pediu que motoboy não acesse.
  
  // Como não há um "login" de administrador formal ainda (apenas manual), 
  // deixaremos as rotas abertas mas separadas visualmente no Home.
  
  return NextResponse.next();
}

export const config = {
  matcher: ['/restaurant/:path*', '/driver/:path*'],
};
