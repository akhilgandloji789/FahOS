using System;
using System.IO;
using System.Threading;
using Windows.Foundation;
using Windows.Media.SpeechRecognition;

class Program
{
    static SpeechRecognizer recognizer;
    static bool isSessionActive = false;

    static void Main(string[] args)
    {
        Console.OutputEncoding = System.Text.Encoding.UTF8;
        try
        {
            recognizer = new SpeechRecognizer();
            Console.WriteLine("INFO:CurrentLanguage:" + recognizer.CurrentLanguage.LanguageTag);
            Console.Out.Flush();

            recognizer.StateChanged += (s, e) =>
            {
                Console.WriteLine("STATE:" + e.State);
                Console.Out.Flush();
            };

            recognizer.RecognitionQualityDegrading += (s, e) =>
            {
                Console.WriteLine("QUALITY_PROBLEM:" + e.Problem);
                Console.Out.Flush();
            };

            var dictation = new SpeechRecognitionTopicConstraint(SpeechRecognitionScenario.Dictation, "dictation");
            recognizer.Constraints.Add(dictation);

            var compileOp = recognizer.CompileConstraintsAsync();
            while (compileOp.Status == AsyncStatus.Started) Thread.Sleep(20);
            var compileResult = compileOp.GetResults();

            if (compileResult.Status != SpeechRecognitionResultStatus.Success)
            {
                Console.WriteLine("ERROR:CompilationFailed:" + compileResult.Status);
                Console.Out.Flush();
                return;
            }

            recognizer.ContinuousRecognitionSession.ResultGenerated += (s, e) =>
            {
                Console.WriteLine("RESULT_STATUS:" + e.Result.Status + " TEXT:" + (e.Result.Text ?? ""));
                Console.Out.Flush();

                if (e.Result != null && !string.IsNullOrWhiteSpace(e.Result.Text))
                {
                    Console.WriteLine("FINAL:" + e.Result.Text);
                    Console.Out.Flush();
                }
            };

            recognizer.HypothesisGenerated += (s, e) =>
            {
                if (e.Hypothesis != null && !string.IsNullOrWhiteSpace(e.Hypothesis.Text))
                {
                    Console.WriteLine("INTERIM:" + e.Hypothesis.Text);
                    Console.Out.Flush();
                }
            };

            recognizer.ContinuousRecognitionSession.Completed += (s, e) =>
            {
                Console.WriteLine("SESSION_COMPLETED:" + e.Status);
                Console.Out.Flush();

                if (isSessionActive)
                {
                    try
                    {
                        var startOp = recognizer.ContinuousRecognitionSession.StartAsync();
                        while (startOp.Status == AsyncStatus.Started) Thread.Sleep(20);
                        Console.WriteLine("AUTO_RESTARTED");
                        Console.Out.Flush();
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine("AUTO_RESTART_ERROR:" + ex.Message);
                        Console.Out.Flush();
                    }
                }
            };

            Console.WriteLine("READY");
            Console.Out.Flush();

            string line;
            while ((line = Console.ReadLine()) != null)
            {
                line = line.Trim();
                if (line == "START")
                {
                    if (!isSessionActive)
                    {
                        try
                        {
                            var startOp = recognizer.ContinuousRecognitionSession.StartAsync();
                            while (startOp.Status == AsyncStatus.Started) Thread.Sleep(20);
                            isSessionActive = true;
                            Console.WriteLine("LISTENING");
                            Console.Out.Flush();
                        }
                        catch (Exception ex)
                        {
                            Console.WriteLine("ERROR:StartFailed:" + ex.Message);
                            Console.Out.Flush();
                        }
                    }
                }
                else if (line == "STOP")
                {
                    if (isSessionActive)
                    {
                        isSessionActive = false;
                        try
                        {
                            var stopOp = recognizer.ContinuousRecognitionSession.StopAsync();
                            while (stopOp.Status == AsyncStatus.Started) Thread.Sleep(20);
                        }
                        catch {}
                        Console.WriteLine("STOPPED");
                        Console.Out.Flush();
                    }
                }
                else if (line == "QUIT")
                {
                    break;
                }
            }

            if (isSessionActive)
            {
                try
                {
                    var stopOp = recognizer.ContinuousRecognitionSession.StopAsync();
                    while (stopOp.Status == AsyncStatus.Started) Thread.Sleep(20);
                }
                catch {}
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine("ERROR:" + ex.Message);
            Console.Out.Flush();
        }
    }
}
