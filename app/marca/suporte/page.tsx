import { HeadphonesIcon, Mail, Clock, MessageCircle } from "lucide-react";

export default function MarcaSuportePage() {
  return (
    <div className="max-w-xl mx-auto px-4 py-10 space-y-6">

      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <HeadphonesIcon size={18} className="text-brand" />
          <h1 className="text-lg font-bold text-white">Suporte</h1>
        </div>
        <p className="text-sm text-gray-500">
          Precisa de ajuda? Entre em contato com nossa equipe.
        </p>
      </div>

      {/* Card principal */}
      <div className="bg-dark-800 border border-white/8 rounded-2xl divide-y divide-white/8 overflow-hidden">

        <div className="p-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center flex-shrink-0">
            <Mail size={18} className="text-brand" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white">E-mail</p>
            <p className="text-xs text-gray-500 mt-0.5">Para dúvidas, ajustes de cadastro e solicitações gerais.</p>
            <a
              href="mailto:contato@phrepresentante.com.br"
              className="inline-flex items-center gap-1.5 mt-2 text-sm font-medium text-brand hover:text-brand/80 transition-colors"
            >
              contato@phrepresentante.com.br
            </a>
          </div>
        </div>

        <div className="p-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-green-400/10 border border-green-400/20 flex items-center justify-center flex-shrink-0">
            <MessageCircle size={18} className="text-green-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white">WhatsApp</p>
            <p className="text-xs text-gray-500 mt-0.5">Atendimento rápido pelo WhatsApp nos dias úteis.</p>
            <a
              href="https://wa.me/5511959993968"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-2 text-sm font-medium text-green-400 hover:text-green-300 transition-colors"
            >
              Abrir WhatsApp
            </a>
          </div>
        </div>

        <div className="p-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center flex-shrink-0">
            <Clock size={18} className="text-gray-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Horário de atendimento</p>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
              Segunda a sexta — 9h às 18h<br />
              Sábado — 9h às 13h
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
