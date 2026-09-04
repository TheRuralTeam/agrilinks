import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { getWalletSummary } from '@/features/wallet/walletService'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Plus, Send } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

const paymentMethods = [
  { value: "multicaixa", label: "Multicaixa Express" },
  { value: "bai", label: "BAI Direto" },
  { value: "afrimoney", label: "Afrimoney" },
  { value: "unitel", label: "Unitel Money" },
];

export default function Wallet() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [wallet, setWallet] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [commissions, setCommissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadWalletData = useCallback(async () => {
    try {
      setLoading(true);

      const { wallet: walletRecord, transactions: txData, commissions: commData } = await getWalletSummary(user?.id);

      setWallet(walletRecord);
      setTransactions(txData || []);
      setCommissions(commData || []);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erro ao carregar carteira", description: err.message });
    } finally {
      setLoading(false);
    }
  }, [toast, user]);

  useEffect(() => {
    if (user) loadWalletData();
  }, [user, loadWalletData]);

  if (loading) return (
    <div className="flex justify-center items-center min-h-screen">
      <div className="animate-spin h-10 w-10 border-b-2 border-green-600 rounded-full"></div>
    </div>
  );

  return (
    <div className="min-h-screen p-4 bg-background">
      <div className="max-w-6xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-green-600 dark:text-green-400">💳 AgriPay</h1>
        <p className="text-muted-foreground">Gerencie seus pagamentos, transferências e comissões</p>

        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
          <WalletCard title="Saldo Disponível" amount={wallet.available_balance} color="green" />
          <WalletCard title="Saldo Bloqueado" amount={wallet.blocked_balance} color="orange" />
          <WalletCard title="Total Recebido" amount={wallet.total_earned} />
          <WalletCard title="Total Gasto" amount={wallet.total_spent} />
        </div>

        <Tabs defaultValue="actions">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="actions">Ações Rápidas</TabsTrigger>
            <TabsTrigger value="history">Histórico</TabsTrigger>
            <TabsTrigger value="commissions">Comissões</TabsTrigger>
          </TabsList>

          <TabsContent value="actions" className="space-y-4 grid md:grid-cols-2 gap-4">
            <DepositForm wallet={wallet} loadWalletData={loadWalletData} />
            <TransferForm wallet={wallet} loadWalletData={loadWalletData} />
          </TabsContent>

          <TabsContent value="history" className="space-y-2">
            {transactions.map(tx => (
              <Card key={tx.id}>
                <CardContent className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">{tx.description}</p>
                    <p className="text-sm text-muted-foreground">{new Date(tx.created_at).toLocaleString()}</p>
                  </div>
                  <p className={`font-bold ${tx.type === "deposit" ? "text-green-600" : "text-red-600"}`}>
                    {tx.type === "deposit" ? "+" : "-"} {formatCurrency(tx.amount)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="commissions" className="space-y-2">
            {commissions.map(comm => (
              <Card key={comm.id}>
                <CardContent className="flex justify-between items-center">
                  <p>{comm.description}</p>
                  <p className="font-bold text-blue-600">{formatCurrency(comm.amount)}</p>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function WalletCard({ title, amount, color = "gray" }: { title: string; amount: number; color?: string }) {
  return (
    <Card>
      <CardHeader><CardDescription>{title}</CardDescription></CardHeader>
      <CardContent>
        <p className={`text-2xl font-bold ${color === "gray" ? "" : `text-${color}-600`}`}>
          {formatCurrency(amount)}
        </p>
      </CardContent>
    </Card>
  );
}

function DepositForm({ wallet, loadWalletData }: any) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [depositAmount, setDepositAmount] = useState("");
  const [depositMethod, setDepositMethod] = useState(paymentMethods[0].value);
  const [processingDeposit, setProcessingDeposit] = useState(false);

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!depositAmount || parseFloat(depositAmount) <= 0) return toast({ variant: "destructive", title: "Valor inválido" });

    try {
      setProcessingDeposit(true);
      const { error } = await supabase.rpc("process_deposit", {
        p_user_id: user?.id,
        p_amount: parseFloat(depositAmount),
        p_description: `Depósito via ${paymentMethods.find(m => m.value === depositMethod)?.label}`,
      });
      if (error) throw error;

      toast({ title: "Depósito realizado", description: formatCurrency(parseFloat(depositAmount)) });
      setDepositAmount("");
      loadWalletData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erro no depósito", description: err.message });
    } finally { setProcessingDeposit(false); }
  };

  return (
    <Card>
      <CardHeader><CardTitle className="flex gap-2 items-center"><Plus className="h-5 w-5" />Adicionar Saldo</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={handleDeposit} className="space-y-3">
          <Label>Valor (AOA)</Label>
          <Input type="number" min="0" step="0.01" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} />
          <Label>Método de Pagamento</Label>
          <Select value={depositMethod} onValueChange={setDepositMethod}>
            <SelectTrigger><SelectValue placeholder="Selecione o método" /></SelectTrigger>
            <SelectContent>
              {paymentMethods.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button type="submit" disabled={processingDeposit}>{processingDeposit ? "Processando..." : "Adicionar Saldo"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}

function TransferForm({ wallet, loadWalletData }: any) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [transferAmount, setTransferAmount] = useState("");
  const [transferEmail, setTransferEmail] = useState("");
  const [transferMethod, setTransferMethod] = useState(paymentMethods[0].value);
  const [processingTransfer, setProcessingTransfer] = useState(false);

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferAmount || parseFloat(transferAmount) <= 0) return toast({ variant: "destructive", title: "Valor inválido" });
    if (!transferEmail) return toast({ variant: "destructive", title: "Email obrigatório" });
    if (parseFloat(transferAmount) > wallet.available_balance) return toast({ variant: "destructive", title: "Saldo insuficiente" });

    try {
      setProcessingTransfer(true);
      const { data: userData, error: userError } = await supabase.from("users").select("id").eq("email", transferEmail).single();
      if (userError || !userData) throw new Error("Usuário não encontrado");

      const { error } = await supabase.rpc("process_internal_transfer", {
        p_from_user_id: user?.id,
        p_to_user_id: userData.id,
        p_amount: parseFloat(transferAmount),
        p_description: `Transferência para ${transferEmail}`,
      });
      if (error) throw error;

      toast({ title: "Transferência realizada", description: formatCurrency(parseFloat(transferAmount)) });
      setTransferAmount("");
      setTransferEmail("");
      loadWalletData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erro na transferência", description: err.message });
    } finally { setProcessingTransfer(false); }
  };

  return (
    <Card>
      <CardHeader><CardTitle className="flex gap-2 items-center"><Send className="h-5 w-5" />Transferir</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={handleTransfer} className="space-y-3">
          <Label>Email do destinatário</Label>
          <Input type="email" value={transferEmail} onChange={e => setTransferEmail(e.target.value)} />
          <Label>Valor (AOA)</Label>
          <Input type="number" min="0" step="0.01" value={transferAmount} onChange={e => setTransferAmount(e.target.value)} />
          <Label>Método de Pagamento</Label>
          <Select value={transferMethod} onValueChange={setTransferMethod}>
            <SelectTrigger><SelectValue placeholder="Selecione o método" /></SelectTrigger>
            <SelectContent>
              {paymentMethods.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button type="submit" disabled={processingTransfer}>{processingTransfer ? "Processando..." : "Transferir"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}