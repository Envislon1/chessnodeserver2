
import { useState } from 'react';
import { WalletIcon } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from '@/hooks/use-toast';
import { useWallet } from '@/hooks/useWallet';
import { useTransactions } from '@/hooks/useTransactions';
import { WalletBalance } from './WalletBalance';
import { WalletDemoWarning } from './WalletDemoWarning';
import { TransactionForm } from './TransactionForm';
import { TransactionHistory } from './TransactionHistory';
import { WithdrawalDialog } from './WithdrawalDialog';
import { CoinConversionInfo } from '@/components/CoinConversionInfo';
import { calculateFee } from '@/utils/feeCalculations';
import { useConversionRate } from '@/hooks/useConversionRate';
import { useBanks } from '@/hooks/useBanks';
import { useAuth } from '@/context/AuthContext';
import { FormEvent } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, RefreshCcw } from 'lucide-react';

export const WalletContainer = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [amount, setAmount] = useState('');
  const [transactionType, setTransactionType] = useState<'deposit' | 'withdraw'>('deposit');
  const [isWithdrawalOpen, setIsWithdrawalOpen] = useState(false);
  const [bankCode, setBankCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isProcessingWithdrawal, setIsProcessingWithdrawal] = useState(false);
  const [withdrawalError, setWithdrawalError] = useState('');
  const [activeTab, setActiveTab] = useState("balance");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCreatingWallet, setIsCreatingWallet] = useState(false);

  const { 
    wallet: { data: wallet, isLoading: walletLoading, refetch: refetchWallet },
    createWallet,
    forceRefresh,
    isRefreshing: isWalletRefreshing
  } = useWallet();
  
  const { 
    data: transactions = [], 
    isLoading: transactionsLoading,
    refreshTransactions,
    isFetching: isRefreshingTransactions
  } = useTransactions(wallet?.id);

  const { data: banksData } = useBanks();
  const banks = banksData || [];

  const { data: conversionRateData } = useConversionRate();

  const nairaRate = typeof conversionRateData?.value === 'object' 
    ? (conversionRateData.value as any).naira_to_coin || 1000 
    : 1000;
  const minDeposit = typeof conversionRateData?.value === 'object' 
    ? (conversionRateData.value as any).min_deposit || 1000 
    : 1000;
  const minWithdrawal = typeof conversionRateData?.value === 'object' 
    ? (conversionRateData.value as any).min_withdrawal || 1000 
    : 1000;

  const handleRefreshWallet = async () => {
    setIsRefreshing(true);
    try {
      forceRefresh();
      await Promise.all([
        refetchWallet(),
        refreshTransactions()
      ]);
      toast({
        title: 'Refreshed',
        description: 'Wallet and transaction data has been refreshed'
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to refresh wallet data',
        variant: 'destructive'
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const ensureWalletExists = async () => {
    if (!wallet?.id) {
      setIsCreatingWallet(true);
      try {
        await createWallet.mutateAsync({
          userId: user?.id as string,
          username: user?.username
        });
        await refetchWallet();
        console.log('Wallet created or fetched successfully');
        return true;
      } catch (error) {
        console.error('Error creating wallet:', error);
        toast({
          title: 'Error',
          description: 'Could not create wallet. Please try again later.',
          variant: 'destructive',
        });
        return false;
      } finally {
        setIsCreatingWallet(false);
      }
    }
    return true;
  };

  const handleRefreshClick = () => {
    handleRefreshWallet();
  };

  const handleDeposit = async () => {
    if (!user) {
      toast({
        title: 'Error',
        description: 'Please log in to make a deposit',
        variant: 'destructive',
      });
      return;
    }
    
    if (!user.email) {
      toast({
        title: 'Error',
        description: 'No email found for your account. Please update your profile.',
        variant: 'destructive',
      });
      return;
    }

    const depositAmount = Number(amount);
    if (isNaN(depositAmount) || depositAmount < minDeposit) {
      toast({
        title: 'Error',
        description: `Minimum deposit amount is ₦${minDeposit.toLocaleString()}`,
        variant: 'destructive',
      });
      return;
    }

    try {
      const walletExists = await ensureWalletExists();
      if (!walletExists) return;
      
      await refetchWallet();
      
      if (!wallet?.id) {
        throw new Error('Wallet not available. Please try again later.');
      }
      
      const depositAmount = Number(amount);
      const feeAmount = calculateFee(depositAmount / nairaRate);
      const reference = `chess_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
      
      const { error: txError } = await supabase.from('transactions').insert({
        wallet_id: wallet.id,
        amount: depositAmount / nairaRate,
        type: 'deposit',
        status: 'pending',
        reference: reference,
        fee_amount: feeAmount
      });
      
      if (txError) {
        throw new Error(`Failed to create transaction: ${txError.message}`);
      }
      
      const response = await supabase.functions.invoke('paystack', {
        body: { 
          amount: depositAmount,
          email: user.email,
          type: 'deposit',
          reference: reference
        },
      });

      if (!response.data?.data?.authorization_url) {
        throw new Error('No payment URL received from payment provider');
      }

      window.location.href = response.data.data.authorization_url;
    } catch (error: any) {
      console.error('Deposit error:', error);
      toast({
        title: 'Payment Error',
        description: error.message || 'Failed to process payment. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const verifyAccount = async () => {
    if (!accountNumber || !bankCode) {
      toast({
        title: 'Error',
        description: 'Please enter your account number and select a bank',
        variant: 'destructive',
      });
      return;
    }

    setIsVerifying(true);
    setWithdrawalError('');
    try {
      const response = await supabase.functions.invoke('verify-withdrawal', {
        body: { 
          accountNumber,
          bankCode
        },
      });
      
      if (response.data?.status) {
        setAccountName(response.data.data?.account_name || '');
        toast({
          title: 'Success',
          description: 'Account verified successfully',
        });
      } else {
        const errorMessage = response.data?.message || response.error?.message || 'Unable to verify account';
        setWithdrawalError(errorMessage);
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      setWithdrawalError('Failed to verify account. Please try again.');
      toast({
        title: 'Error',
        description: 'Failed to verify account',
        variant: 'destructive',
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleWithdrawal = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast({
        title: 'Error',
        description: 'Please log in to make a withdrawal',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessingWithdrawal(true);
    setWithdrawalError('');
    
    try {
      const withdrawalAmount = Number(amount);
      const coins = withdrawalAmount / nairaRate;
      const feeAmount = calculateFee(coins);
      const totalCoinsNeeded = coins + feeAmount;

      if (!wallet?.balance || wallet.balance <= 0) {
        throw new Error('Your wallet balance is zero. Please deposit funds first.');
      }
      
      if (wallet?.balance && totalCoinsNeeded > wallet.balance) {
        throw new Error(`Insufficient coins for withdrawal including 1% fee. Your maximum withdrawal amount is ₦${((wallet.balance - feeAmount) * nairaRate).toLocaleString()}`);
      }

      if (!accountNumber || !bankCode || !accountName) {
        throw new Error('Please verify your account details first');
      }

      const walletExists = await ensureWalletExists();
      if (!walletExists) return;
      
      await refetchWallet();
      
      if (!wallet?.id) {
        throw new Error('Wallet not available. Please try again later.');
      }
      
      const { data: txData, error: txError } = await supabase.from('transactions').insert({
        wallet_id: wallet.id,
        amount: coins,
        type: 'withdrawal',
        status: 'processing',
        fee_amount: feeAmount,
        payout_details: {
          account_number: accountNumber,
          bank_code: bankCode,
          account_name: accountName
        }
      }).select('id').single();
      
      if (txError) {
        throw new Error(`Failed to create transaction: ${txError.message}`);
      }

      await supabase.from('wallets').update({
        balance: (wallet?.balance || 0) - coins,
        updated_at: new Date().toISOString()
      }).eq('id', wallet?.id);
      
      await supabase.from('transactions')
        .update({ status: 'completed' })
        .eq('id', txData.id);

      toast({
        title: 'Success',
        description: 'Withdrawal request submitted successfully',
      });
      
      setAmount('');
      setIsWithdrawalOpen(false);
      setAccountNumber('');
      setBankCode('');
      setAccountName('');
      setWithdrawalError('');
      
      await Promise.all([
        refetchWallet(),
        refreshTransactions()
      ]);
    } catch (error: any) {
      console.error('Withdrawal error:', error);
      setWithdrawalError(error.message || 'An unexpected error occurred');
      toast({
        title: 'Error',
        description: error.message || 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsProcessingWithdrawal(false);
    }
  };

  if (walletLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-chess-accent"></div>
        <span className="ml-3">Loading wallet...</span>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <WalletIcon className="h-7 w-7" /> Wallet
        </h1>
        <Button 
          onClick={handleRefreshClick} 
          variant="outline" 
          size="sm"
          disabled={isRefreshing || isWalletRefreshing}
        >
          {(isRefreshing || isWalletRefreshing) ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCcw className="h-4 w-4" />
          )}
          <span className="ml-2">Refresh</span>
        </Button>
      </div>
      
      {wallet?.is_demo && <WalletDemoWarning />}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="balance">Balance & Transactions</TabsTrigger>
          <TabsTrigger value="info">Coin Information</TabsTrigger>
        </TabsList>
        
        <TabsContent value="balance" className="space-y-6">
          <WalletBalance 
            wallet={wallet} 
            isRefreshing={isRefreshing || isWalletRefreshing}
            onRefresh={handleRefreshClick}
          />

          {!wallet?.is_demo && (
            <TransactionForm
              transactionType={transactionType}
              setTransactionType={setTransactionType}
              amount={amount}
              setAmount={setAmount}
              handleDeposit={handleDeposit}
              setIsWithdrawalOpen={setIsWithdrawalOpen}
              minAmount={transactionType === 'deposit' ? minDeposit : minWithdrawal}
              nairaRate={nairaRate}
            />
          )}

          <Card className="border-chess-brown/50 bg-chess-dark/90">
            <CardHeader>
              <CardTitle>Transaction History</CardTitle>
              <CardDescription>Your recent deposits and withdrawals</CardDescription>
            </CardHeader>
            <CardContent>
              <TransactionHistory 
                transactions={transactions}
                isLoading={transactionsLoading}
                nairaRate={nairaRate}
                onRefresh={refreshTransactions}
                isRefreshing={isRefreshingTransactions}
              />
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="info">
          <CoinConversionInfo />
        </TabsContent>
      </Tabs>

      <WithdrawalDialog 
        isOpen={isWithdrawalOpen}
        onOpenChange={setIsWithdrawalOpen}
        amount={amount}
        bankCode={bankCode}
        setBankCode={setBankCode}
        accountNumber={accountNumber}
        setAccountNumber={setAccountNumber}
        accountName={accountName}
        isVerifying={isVerifying}
        verifyAccount={verifyAccount}
        handleWithdrawal={handleWithdrawal}
        banks={banks}
        isProcessing={isProcessingWithdrawal}
        error={withdrawalError}
        setAmount={setAmount}
        walletBalance={wallet?.balance}
        nairaRate={nairaRate}
      />
    </div>
  );
};
