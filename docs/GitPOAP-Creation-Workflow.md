# Workflow for Creating GitPOAPs

This guide outlines the process for creating GitPOAPs. It should be updated whenever the backend changes
things related to GitPOAP creation or the various automation steps handled by the backend.

## General Steps

1. Ensure that the project knows that we will be skipping all forks if they choose to include all the
   repos in their GitHub organizations. If they confirm they want to include additional forks we can
   can perform we can add them during step 5 or 8 after the General Steps are completed.
2. Open up a shell terminal.
4. [Choose how]() to set `GITHUB_ACCESS_TOKEN` in the ENV.
5. Clone [`count-yearly-contributors`](https://github.com/gitpoap/count-yearly-contributors), and for:
    * A set of repos like `foo/bar gitpoap/gitpoap-backend` (or just one), run the command:
        ```sh
        ./count.py --repos foo/bar gitpoap/gitpoap-backend
        ```
    * A set of orgs like `foo gitpoap` (or just one), run the command:
        ```sh
        ./count.py --orgs foo gitpoap
        ```
6. This command will output (in a new folder) two files. One will be named something like `*counts.csv`.
    Within this file is contained a listing of the number of contributors for each year to what
    was specified like:
    ```csv
    year,contributorCount
    2021,3
    2022,6
    ```
7. Head over to the [admin page for creating multiple GitPOAPs](https://www.gitpoap.io/admin/gitpoap/create-multiple),
    and create a GitPOAP for each year that was output, using the output `contributorCount` for that year as a guide.
    It is good practice to add 10-20 extra codes as a buffer for a previous year and 40-50 for the current year. **Ensure
    that the current year is marked as "ongoing"!**
    and replacing the `repo` and `organization` name to be the one that was used in step 7.
8. Since the current admin UI only lets a single repo be added per GitPOAP at this time (this will be updated), we need to
    now add the remaining repositories to the repository. If you started with a set of repos already, you can skip this step.
    If not, we need to run the [`organization-repos`]() to collect all the repositories that are not forks:
    ```sh
    ./organization-repos.py --orgs foo gitpoap
    ```
    which outputs a list of repos on separate lines.
9. Now grab a GitPOAP JWT token by (assuming firefox or chrome):
    1. Navigating to https://gitpoap.io (or **refreshing** an open page)
    2. Left clicking anywhere and selecting something like the option "Inspect"
    3. Clicking on the "Storage" tab and then the "Local Storage"
    4. Copying the value (with parentheses included) for the key "accessToken"
10. [Set]() `GITPOAP_ACCESS_TOKEN` in the ENV (*don't* put this one in `~/.bashrc` since it expires every 10 minutes)
11. Run [`add-repos-to-project`](https://github.com/gitpoap/add-repos-to-project) with the repos from step 8 to add the
     repos to an existing project (it will confirm that everything looks right). You should use the `--repo-path` option
     to help pick the correct Project and supply it the repo name from step 7:
     ```sh
     ./add-repos-to-project.py -b https://api.gitpoap.io --repo-path step-7/repo-name --new-repos new/repos go/here
     ```

## Appendix

### Setting ENV variables

There's a few ways that one can set environment variables in the shell:

* Prefixing the command with the environment:
    ```sh
    SOME_VAR=foo ./command.sh ...
    ```
    Note that this will have to be repeated for *every* command that needs that ENV variable.
* Exporting the command in the shell before running the command:
    ```sh
    export SOME_VAR=foo

    # Now you can run a bunch of commands that use the ENV var
    # without needed to resissue the above command
    ./command.sh
    ./other-command.sh
    ```
* Setting the ENV variable in `~/.bashrc`, by adding the line `export SOME_VAR=foo`: By doing this
    the command will already be set every time you open the shell. Note that this is probably best
    not to do with variable that will need to be reset frequently.
