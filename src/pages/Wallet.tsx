import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
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

type WalletData = {
  id: string;
  user_id: string;
  blocked_balance: number | null;
};

type WalletTransaction = {
  id: string;
  wallet_id: string;
  type: string;
  status: string;
  amount: number;
  description: string;
  created_at: string;
};

type WalletCommission = {
  id: string;
  amount: number;
  description: string;
};

type WalletSummary = WalletData & {
  total_earned: number;
  total_spent: number;
  available_balance: number;
  blocked_balance: number;
};

type FormProps = {
  wallet: WalletSummary;
  loadWalletData: () => Promise<void>;
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }

  return "Erro inesperado";
};

export default function Wallet() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [commissions, setCommissions] = useState<WalletCommission[]>([]);
  const [loading, setLoading] = useState(true);

  const loadWalletData = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Carregar ou criar carteira
      const { data: walletDataResponse, error: walletError } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", user?.id)
        .maybeSingle();
      if (walletError) throw walletError;

      let walletData = walletDataResponse as WalletData | null;

      if (!walletData) {
        const { data: newWallet, error: createError } = await supabase
          .from("wallets")
          .insert({ user_id: user.id })
          .select()
          .single();
        if (createError) throw createError;
        walletData = newWallet as WalletData;
      }

      // Carregar transações
      const { data: txData } = await supabase
        .from("transactions")
        .select("*")
        .eq("wallet_id", walletData.id)
        .order("created_at", { ascending: false })
        .limit(50);

      // Carregar comissões
      const { data: commData } = await supabase
        .from("commissions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      // Atualizar saldo baseado nas transações
      const parsedTxData = (txData || []) as WalletTransaction[];
      const parsedCommData = (commData || []) as WalletCommission[];

      const totalEarned = parsedTxData.filter(tx => tx.type === "deposit" && tx.status === "completed")
        .reduce((sum, tx) => sum + Number(tx.amount), 0) || 0;
      const totalSpent = parsedTxData.filter(tx => tx.type === "internal_transfer" && tx.status === "completed")
        .reduce((sum, tx) => sum + Number(tx.amount), 0) || 0;

      setWallet({
        ...walletData,
        total_earned: totalEarned,
        total_spent: totalSpent,
        available_balance: totalEarned - totalSpent,
        blocked_balance: walletData.blocked_balance || 0,
      });

      setTransactions(parsedTxData);
      setCommissions(parsedCommData);
    } catch (error: unknown) {
      toast({ variant: "destructive", title: "Erro ao carregar carteira", description: getErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, [toast, user?.id]);

  useEffect(() => {
    loadWalletData();
  }, [loadWalletData]);

  if (loading) return (
    <div className="flex justify-center items-center min-h-screen">
      <div className="animate-spin h-10 w-10 border-b-2 border-green-600 rounded-full"></div>
    </div>
  );

  if (!wallet) {
    return null;
  }

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

function DepositForm({ wallet, loadWalletData }: FormProps) {
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
    } catch (error: unknown) {
      toast({ variant: "destructive", title: "Erro no depósito", description: getErrorMessage(error) });
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

function TransferForm({ wallet, loadWalletData }: FormProps) {
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
    } catch (error: unknown) {
      toast({ variant: "destructive", title: "Erro na transferência", description: getErrorMessage(error) });
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